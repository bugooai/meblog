#!/usr/bin/env bash
# git-sync.sh —— github 推拉「先试直连，网络类失败自动走 Clash 代理重试一次」。
#
# 设计约束（见 docs/RUN_LOCALLY.md 第 9 节）：
#   - 直连 github 是按天抖，不是永久断，所以不能写死「永远走代理」。
#   - 代理只绑到 URL scope（默认 https://github.com/），npm / pypi / 国内站点照常直连。
#   - `api.github.com` 永远钉死直连：走代理会被按出口 IP 随机拒（403），比慢更糟。
#   - 不写任何 git config，用完零残留 —— 撤销方法就是不再调用本脚本。
#   - 全部路径失败时非零退出并说明试过哪几条路，不静默。
#
# 用法：把 git 换成 scripts/git-sync.sh，参数原样透传
#   scripts/git-sync.sh push origin dev
#   scripts/git-sync.sh fetch --prune
#   scripts/git-sync.sh ls-remote https://github.com/bugooai/meblog HEAD
#   scripts/git-sync.sh probe          # 只测连通性（含控制器端口），不动仓库
#
# 可选覆盖（不设置就用默认值）：
#   GIT_SYNC_PROXY_CANDIDATES   依次尝试的代理口，空格分隔
#   GIT_SYNC_PROXY_URL_SCOPE    代理生效的 URL scope
#   GIT_SYNC_SKIP_DIRECT=1      跳过直连，直接用代理（排障/取证用）
#   GIT_SYNC_DIRECT_LOW_SPEED_TIME / GIT_SYNC_PROXY_LOW_SPEED_TIME
#                               低于 LOW_SPEED_LIMIT 字节/秒持续这么久判为卡死
set -uo pipefail

PROXY_CANDIDATES="${GIT_SYNC_PROXY_CANDIDATES-http://host.docker.internal:7897 http://192.168.65.254:7897}"
# 控制器端口不固定（Clash Verge 默认 9097，Clash 内核/多数配置默认 9090），所以两个都探
CONTROLLER_CANDIDATES="${GIT_SYNC_CONTROLLER_CANDIDATES-host.docker.internal:9097 host.docker.internal:9090 192.168.65.254:9097 192.168.65.254:9090}"
PROXY_URL_SCOPE="${GIT_SYNC_PROXY_URL_SCOPE-https://github.com/}"
# api.github.com 走代理会被 GitHub 按出口 IP 随机拒（14:51 连续 403，15:04 复测 200），
# 所以无论走哪条路都把它钉死直连；空值 = 禁用代理，实测能覆盖全局 http.proxy
NEVER_PROXY_HOSTS="${GIT_SYNC_NEVER_PROXY_HOSTS-api.github.com}"
LOW_SPEED_LIMIT="${GIT_SYNC_LOW_SPEED_LIMIT-1000}"
DIRECT_LOW_SPEED_TIME="${GIT_SYNC_DIRECT_LOW_SPEED_TIME-20}"
PROXY_LOW_SPEED_TIME="${GIT_SYNC_PROXY_LOW_SPEED_TIME-60}"
SKIP_DIRECT="${GIT_SYNC_SKIP_DIRECT-0}"

export GIT_TERMINAL_PROMPT="${GIT_TERMINAL_PROMPT-0}"

LOG=""
LAST_RC=0
LAST_SECONDS=0

usage() {
  sed -n '2,23p' "$0" | sed 's/^# \{0,1\}//'
}

# 凭据可能被 git 打进错误信息里的 URL，输出前抹掉 user:pass@ 段
scrub() {
  sed -E 's#([A-Za-z][A-Za-z0-9+.-]*://)[^/@[:space:]]*@#\1***:***@#g'
}

run_git() {
  local low_speed_time="$1"
  local proxy="$2"
  shift 2
  local args=(-c "http.lowSpeedLimit=$LOW_SPEED_LIMIT" -c "http.lowSpeedTime=$low_speed_time")
  local host
  for host in $NEVER_PROXY_HOSTS; do
    args+=(-c "http.https://${host}.proxy=")
  done
  [ -n "$proxy" ] && args+=(-c "http.${PROXY_URL_SCOPE}.proxy=$proxy")

  LOG="$(mktemp "${TMPDIR:-/tmp}/git-sync.XXXXXX")"
  local started ended
  started="$(date +%s)"
  git "${args[@]}" "$@" 2>"$LOG"
  LAST_RC=$?
  ended="$(date +%s)"
  LAST_SECONDS=$((ended - started))
  scrub <"$LOG" >&2
  return "$LAST_RC"
}

# 只有网络类失败才值得换路重试；认证失败 / non-fast-forward 直接冒泡，别掩盖
looks_like_network_failure() {
  [ -s "$LOG" ] || return 1
  grep -Eiq \
    -e 'Failed to connect' \
    -e 'Could not resolve host' \
    -e 'Connection refused' \
    -e 'Connection timed out' \
    -e 'timed out' \
    -e 'Connection reset' \
    -e 'Empty reply' \
    -e 'encountered end of file' \
    -e 'Recv failure' \
    -e 'Send failure' \
    -e 'remote end hung up' \
    -e 'SSL_read' \
    -e 'SSL_ERROR' \
    -e 'GnuTLS' \
    -e 'HTTP/2 stream' \
    -e 'unable to access' \
    -e 'The requested URL returned error: 5[0-9][0-9]' \
    "$LOG"
}

probe() {
  local targets=(https://github.com https://api.github.com https://www.baidu.com)
  local paths=('direct|' 'proxy|http://host.docker.internal:7897' 'proxy|http://192.168.65.254:7897')
  printf '%-34s %-38s %s\n' 'TARGET' 'PATH' 'RESULT'
  local t p kind url out rc
  for t in "${targets[@]}"; do
    for p in "${paths[@]}"; do
      kind="${p%%|*}"
      url="${p#*|}"
      if [ "$kind" = direct ]; then
        out="$(curl -s -o /dev/null -m 12 -w '%{http_code} / %{time_total}s' "$t")"
        rc=$?
      else
        out="$(curl -s -o /dev/null -m 12 -w '%{http_code} / %{time_total}s' -x "$url" "$t")"
        rc=$?
      fi
      if [ $rc -ne 0 ]; then
        out="失败 curl_exit=$rc"
      fi
      printf '%-34s %-38s %s\n' "$t" "$kind $url" "${out:-无响应}"
    done
  done
  probe_controller
  printf '%s\n' '注：代理路径要 Clash 在跑；7897 是 mixed 端口（直接 GET /version 会得到 400，属正常，它不是控制器）。'
}

# 控制器探测：端口以实际配置为准，别只试 9090
probe_controller() {
  local hp code rc
  printf '%s\n' '--- 外部控制器（查延迟/切节点才用得上）---'
  for hp in $CONTROLLER_CANDIDATES; do
    code="$(curl -s -o /dev/null -m 5 -w '%{http_code}' "http://$hp/version")"
    rc=$?
    if [ $rc -ne 0 ]; then
      printf '%-34s %s\n' "http://$hp/version" "不可达 curl_exit=$rc（多半是没监听在这个地址/端口）"
    elif [ "$code" = "200" ]; then
      printf '%-34s %s\n' "http://$hp/version" "HTTP 200 —— 控制器已放开且**没有 secret**，同网段任何设备都能改路由，立刻设 secret"
    elif [ "$code" = "401" ] || [ "$code" = "403" ]; then
      printf '%-34s %s\n' "http://$hp/version" "HTTP $code —— 已放开且在要 secret，这是期望状态；网管带 secret 即可查 /proxies"
    else
      printf '%-34s %s\n' "http://$hp/version" "HTTP $code"
    fi
  done
}

main() {
  if [ "$#" -eq 0 ]; then
    usage
    exit 2
  fi
  if [ "$1" = probe ]; then
    probe
    return 0
  fi

  if [ "$SKIP_DIRECT" != 1 ]; then
    printf '%s\n' '[git-sync] 第 1 步：直连' >&2
    if run_git "$DIRECT_LOW_SPEED_TIME" "" "$@"; then
      printf '[git-sync] 成功：直连，%ss，未使用代理\n' "$LAST_SECONDS" >&2
      return 0
    fi
    if ! looks_like_network_failure; then
      printf '[git-sync] 直连失败（rc=%s）但不是网络类错误，不重试代理，原样退出\n' "$LAST_RC" >&2
      return "$LAST_RC"
    fi
    printf '[git-sync] 直连网络失败（rc=%s，%ss），改用代理重试\n' "$LAST_RC" "$LAST_SECONDS" >&2
  fi

  local proxy
  for proxy in $PROXY_CANDIDATES; do
    printf '[git-sync] 重试：%s\n' "$proxy" >&2
    if run_git "$PROXY_LOW_SPEED_TIME" "$proxy" "$@"; then
      printf '[git-sync] 成功：走 %s，%ss（仅本次命令生效，未写 git config）\n' "$proxy" "$LAST_SECONDS" >&2
      return 0
    fi
    if ! looks_like_network_failure; then
      printf '[git-sync] %s 失败（rc=%s）但不是网络类错误，停止重试\n' "$proxy" "$LAST_RC" >&2
      return "$LAST_RC"
    fi
    printf '[git-sync] %s 网络失败（rc=%s，%ss）\n' "$proxy" "$LAST_RC" "$LAST_SECONDS" >&2
  done

  printf '%s\n' "[git-sync] 全部路径失败：已试过 直连 + ${PROXY_CANDIDATES}。git 配置未被改动，无需回滚。下一步：确认 Clash 在跑（7897），再跑一次 scripts/git-sync.sh probe" >&2
  return "$LAST_RC"
}

main "$@"
