#!/usr/bin/env bash
# check-container-name-spelling.sh —— 容器名/服务名拼写门禁（github 侧 CI 的第一条 job）。
#
# 拦的是本周真实发生过的那类事故：compose 引用侧写成「多一个 m」的那个拼法，
# 而 `container_name` 用的是正确拼法。名字对不上时 Docker DNS 不会立刻报错，
# 要等约 2 秒才回 SERVFAIL —— 页面照样 200，只是每个 SSR 请求白等一次，
# 线上 `/` 因此 4.02 秒。`5cc24e6` 一次修掉 15 处，靠的是人肉复盘。
# 这条门禁的作用就是让同类改动在合入前变红，而不是等线上变慢才发现。
#
# 口径（想动这里之前先读，别把它调成永远绿）：
#   - 扫 git 跟踪的全部文本文件，和 CI 里 checkout 出来的那份一致；本地多加 --untracked，
#     这样「新加但还没 git add」的文件也能当场扫到（CI 里工作区是干净的，这条不改变结果）。
#     .gitignore 里的东西（node_modules、.env、*.db）照旧不扫。
#   - 整串匹配、大小写不敏感。
#   - 只报 path:line，不回显命中内容：仓库和 Action 日志都是公开的，
#     命中行里可能带地址或口令，让人自己打开文件看那一行。
#   - 例外按文件逐条写在下面 ALLOW 里，每条都要带理由。新增例外要有人在 review 里点头；
#     不允许整目录排除，也不允许靠放宽匹配来换一次变绿。
#
# 用法（CI 和本地跑同一条命令，口径不会漂移）：
#   bash scripts/check-container-name-spelling.sh
set -uo pipefail

# 禁用串拆成两段拼出来：连着写在本文件里，门禁就会命中自己。
FORBIDDEN="$(printf '%s%s' 'memb' 'log')"

# 逐条例外，用的是 git 的排除 pathspec（:!path）。
# docs/HARDENING.md 是复盘文档本身，它命中这个串是在记录错误拼写长什么样，不是用它。
ALLOW=(
  ':!docs/HARDENING.md'
)

root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "FAIL: 没找到 git 仓库根，请在仓库里跑本脚本。" >&2
  exit 2
}
cd "$root" || exit 2

out="$(git grep -n -I --untracked --ignore-case -F -e "$FORBIDDEN" -- ${ALLOW[@]+"${ALLOW[@]}"})"
rc=$?

if [ "$rc" -gt 1 ]; then
  echo "FAIL: git grep 执行失败（exit $rc），门禁这次没跑成，不算通过。" >&2
  exit 2
fi

if [ "$rc" -eq 1 ]; then
  echo "OK: 没有命中旧拼法。例外文件：${ALLOW[*]:-（无）}"
  exit 0
fi

locs="$(printf '%s\n' "$out" | sed -E 's#^([^:]*:[0-9]+):.*#\1#' | sort -u)"
count="$(printf '%s\n' "$locs" | grep -c .)"

echo "FAIL: 命中 $count 处旧拼法（多一个 m 的那个）："
printf '%s\n' "$locs" | while IFS= read -r loc; do
  [ -n "$loc" ] && echo "  $loc"
done
cat <<'HINT'

怎么修：
  1) 容器名以 docker-compose-*.yml 里的 container_name 为准，改引用侧，别反过来改 container_name
     （换 container_name 等于换 DNS 名，会连带影响线上那份手写 .env，见 docs/HARDENING.md 第 2 节）。
  2) 本地复跑同一条命令确认变绿：bash scripts/check-container-name-spelling.sh
  3) 真要是复盘文档不得不写这个串，才在脚本的 ALLOW 里加一行，并写清理由。
HINT
exit 1
