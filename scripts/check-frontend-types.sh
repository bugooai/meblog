#!/usr/bin/env bash
# check-frontend-types.sh —— 前端类型检查门禁（github 侧 CI 的第二条 job，CMP-15）。
#
# 本地和 CI 跑的是同一条命令：
#   bash scripts/check-frontend-types.sh
# 冷启动（frontend/node_modules 还没装）时加 --install。CI 里安装单独占一步
# （那一步要吃 pnpm store 缓存），所以 CI 调的仍是不带 --install 的这条。
#
# 脚本里只有两步，两步都是必须的：
#
#   1) next typegen —— 先生成 .next/types/（routes.d.ts、validator.ts、cache-life.d.ts）。
#      为什么不能跳过：frontend/next-env.d.ts 里有一行 `import "./.next/types/routes.d.ts"`，
#      而 .next/ 在 .gitignore 里，CI 冷 checkout 根本没有这个目录；tsconfig.json 的 include
#      又带了 ".next/types/**/*.ts"。不生成，CI 检查的文件集就比开发机少一份路由类型校验
#      —— 那种「本地红、CI 绿」的漂移正是这条门禁要避免的。
#      2026-10-17 实测：typegen 只往 .next/ 里写，不动任何被 git 跟踪的文件
#      （next-env.d.ts 生成前后逐字节一致），跑完 tsc 仍然 exit 0。
#
#   2) tsc --noEmit --pretty false
#      tsconfig.json 里已经写了 noEmit，这里再显式写一遍，命令自己说得清自己在干什么。
#      --pretty false 是关键：它保证输出是一行一条、**不带源码片段**（带颜色的 pretty
#      模式会把出错那几行源码原样打出来）。仓库是公开的（github.com/bugooai/meblog），
#      Action 日志也是公开的，所以失败信息只给 path:line:col + 错误码 + 类型层面的说明，
#      和拼写门禁（check-container-name-spelling.sh）一个口径：不把命中内容回显进日志。
#
# 退出码：0 = 通过；1 = 有类型错误 / 依赖装不上 / typegen 失败；2 = 环境不对（脚本自己没跑起来）。
#
# 基线：2026-10-17 在 dev=b94ac5f 实测，装了依赖的工作区 exit 0，零报错；
#       同一次提交冷 checkout（无 .next）+ 装依赖 + typegen 之后也是 exit 0。
#       也就是说这条 job 落地当天就是绿的，不会挡「合入前 CI 必须绿」那条口径。
#
# 红的时候怎么办：先本地跑同一条命令复现，按 path:line:col 打开文件看那一行。
# 不要为了让它变绿去 tsconfig 里关 strict、加 exclude，或者往源码里塞 @ts-ignore ——
# 那等于把门禁拆了。真要在工单上写清理由再动。
set -uo pipefail

usage() {
  echo "用法：bash scripts/check-frontend-types.sh [--install]"
  echo "  --install   先跑 pnpm install --frozen-lockfile（本地冷启动用；CI 里安装是单独一步）"
}

root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "FAIL: 没找到 git 仓库根，请在仓库里跑本脚本。" >&2
  exit 2
}
cd "$root" || exit 2

do_install=0
for arg in "$@"; do
  case "$arg" in
    --install) do_install=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "FAIL: 不认的参数 '$arg'。" >&2; usage >&2; exit 2 ;;
  esac
done

cd frontend || exit 2

if [ "$do_install" -eq 1 ]; then
  command -v pnpm >/dev/null 2>&1 || {
    echo "FAIL: 没找到 pnpm。CI 里钉的版本见 .github/workflows/ci.yml。" >&2
    exit 2
  }
  echo "==> pnpm install --frozen-lockfile"
  if ! pnpm install --frozen-lockfile; then
    echo "FAIL: 依赖没装成，类型检查这次没跑成，不算通过。" >&2
    echo "      --frozen-lockfile 的意思是「锁文件和 package.json 对不上就直接失败」。" >&2
    echo "      真改了依赖就正常跑一次 pnpm install，把 frontend/pnpm-lock.yaml 一起提交。" >&2
    exit 1
  fi
fi

tsc_bin="./node_modules/.bin/tsc"
next_bin="./node_modules/.bin/next"
for bin in "$tsc_bin" "$next_bin"; do
  if [ ! -x "$bin" ]; then
    echo "FAIL: 缺 $bin —— 依赖还没装，类型检查这次没跑成，不算通过。" >&2
    echo "      装依赖：cd frontend && pnpm install --frozen-lockfile" >&2
    echo "      或者直接：bash scripts/check-frontend-types.sh --install" >&2
    exit 2
  fi
done

echo "==> next typegen（生成 .next/types，让 CI 和开发机检查同一份文件集）"
if ! "$next_bin" typegen; then
  echo "FAIL: next typegen 没跑成，路由类型没生成，后面的 tsc 结果不能信。" >&2
  exit 1
fi

echo "==> tsc --noEmit"
raw="$("$tsc_bin" --noEmit --pretty false 2>&1)"
rc=$?

if [ "$rc" -eq 0 ]; then
  echo "OK: 前端类型检查通过（tsc --noEmit，零报错）。"
  exit 0
fi

# tsc 原生格式是 path(line,col): error TSxxxx: message，这里归一成 path:line:col，
# 和拼写门禁的输出对齐，也方便编辑器 / Action 注解直接跳过去。message 保留（它是类型
# 层面的说明，不含源码行），源码片段由 --pretty false 从源头上就挡掉了。
locs="$(printf '%s\n' "$raw" \
  | sed -nE 's#^([^(]+)\(([0-9]+),([0-9]+)\): (error TS[0-9]+:.*)$#\1:\2:\3 \4#p' \
  | sort -u)"
count="$(printf '%s\n' "$locs" | grep -c . || true)"

if [ "${count:-0}" -eq 0 ]; then
  # 一条都没解析出来 = tsc 不是正常报错（多半是自己崩了），原样打出来好查。
  echo "FAIL: tsc --noEmit exit $rc，但没解析出任何 path:line 形式的报错。原始输出前 40 行：" >&2
  printf '%s\n' "$raw" | head -40 >&2
  exit 1
fi

echo "FAIL: tsc --noEmit 报了 $count 处类型错误（exit $rc）。位置如下（不贴源码）："
printf '%s\n' "$locs" | head -200 | sed 's/^/  /'
if [ "$count" -gt 200 ]; then
  echo "  ……还有 $((count - 200)) 处没列出来，本地复跑同一条命令看全量。"
fi
cat <<'HINT'

怎么修：
  1) 本地复跑同一条命令：bash scripts/check-frontend-types.sh
  2) 按 path:line:col 打开那一行改类型，别加 @ts-ignore，也别去 tsconfig 里关 strict / 加 exclude。
  3) 改了依赖记得把 frontend/pnpm-lock.yaml 一起提交，否则 CI 的 --frozen-lockfile 会先红。
HINT
exit 1
