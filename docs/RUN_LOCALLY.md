# 本地跑起来（Windows / PowerShell）

已在 `dev` 分支实测通过：后端 8000 + 前端 3000，注册/登录/建标签/建项目/发文/前台渲染/RSS 全绿。

## 0. 一句话结论

**一个环境变量都不配也能跑起来。** 后端所有配置都有默认值（SQLite + 占位密钥），前端开发模式把后端地址硬编码成 `http://127.0.0.1:8000` 并走同源代理。

真正"缺"的是三件事，见第 4 节：图片上传要 OSS 四项、发文后缓存刷新要 revalidate 三件套、`SECRET_KEY` 还是公开占位值。

## 1. 前置工具

| 工具 | 版本要求 | 备注 |
|---|---|---|
| Python | **3.12**（必须） | `pydantic==2.6.0` 依赖的 `pydantic-core==2.16.1` 在 3.13 上没有 Windows 预编译包，会退回源码编译并失败。已写入 `backend/.python-version` |
| uv | 任意新版 | `pip install uv` 或 `winget install astral-sh.uv` |
| Node.js | 20+ | 实测 24 |
| pnpm | 9+ | `corepack enable` 或 `npm i -g pnpm` |

不需要 PostgreSQL，不需要 Redis（`REDIS_URL` 在代码里没有任何引用，`pyproject.toml` 里也没有 redis 依赖）。

## 2. 后端

```powershell
cd D:\code\ai\meblog\backend

# 1) 装依赖（第一次约 1-2 分钟）
uv sync --python 3.12

# 2) 复制环境变量模板并编辑
Copy-Item .env.local.example .env.local
notepad .env.local

# 3) 启动（必须停在 backend 目录，见下方"坑 1"）
$env:APP_ENV = "local"
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

验证：浏览器打开 <http://127.0.0.1:8000/health> 应返回 `{"status":"ok"}`，
<http://127.0.0.1:8000/docs> 是接口文档。表会在启动时自动创建（`app/main.py` 的 startup 钩子里 `create_all`），SQLite 文件落在 `backend/meblog.db`，已被 `.gitignore` 忽略。

### 创建第一个账号（只能从 API 建）

前端只有登录页，**没有注册页**，而 `ALLOW_REGISTRATION` 默认是 `false`。
例外：`admins` 表为空时第一个账号仍可注册（用于初始化）。所以第一次必须用命令行建号：

```powershell
$body = @{ username = "bugu"; email = "you@example.com"; password = "至少8位" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/api/v1/auth/register" `
  -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
```

约束：`username` 3-20 位且只允许 `\w`（字母数字下划线），`password` ≥ 8 位。
之后第二个账号会返回 `403 Registration is closed`，想放开就在 `.env.local` 里设 `ALLOW_REGISTRATION=true`。

## 3. 前端

```powershell
cd D:\code\ai\meblog\frontend

pnpm install
Copy-Item .env.local.example .env.local
notepad .env.local          # 只想看页面可以直接跳过这步

pnpm dev --port 3000
```

打开 <http://localhost:3000>，用 `/login` 登录后台（`/admin`）。
开发模式下第一个页面编译要 10 秒左右，属正常。

## 4. 环境变量清单

### 后端 `backend/.env.local`

| 变量 | 本地是否必需 | 默认值 | 说明 |
|---|---|---|---|
| `DATABASE_URL` | **建议显式写** | `sqlite:///./meblog.db` | 见"坑 2"。用 PostgreSQL 写 `postgresql://...`，代码自动换成 asyncpg 驱动 |
| `SECRET_KEY` | **建议换掉** | 占位字符串 | JWT 签名密钥，占位值等于公开密钥。改动会让已登录 token 全部失效 |
| `APP_ENV` | 可选 | `local` | 决定读哪个文件：`local`→`.env.local`，`test`→`.env.test`，`production`→`.env.production` |
| `SITE_URL` | 可选 | `http://localhost:3000` | 后端 `/sitemap.xml`、`/feed.xml` 里的绝对地址 |
| `BACKEND_CORS_ORIGINS` | 可选 | `http://localhost:3000` | 逗号分隔。走前端代理时不需要；浏览器直连 8000 时必须包含页面来源，否则预检 400 |
| `ALLOW_REGISTRATION` | 可选 | `false` | 空库时第一个账号仍可注册 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 可选 | `10080`（7 天） | 登录有效期 |
| `FRONTEND_REVALIDATE_URL` | **可选，但缺了发文不刷新** | 空 | 填 `http://127.0.0.1:3000/api/internal/revalidate` |
| `FRONTEND_REVALIDATE_TOKEN` | 同上 | 空 | 必须等于前端 `REVALIDATE_SECRET`；两者任一为空 → 后端静默不发通知 |
| `OSS_ENDPOINT` `OSS_ACCESS_KEY_ID` `OSS_ACCESS_KEY_SECRET` `OSS_BUCKET` | **只有上传图片/附件才需要** | 空 | 缺任一个，上传接口报 `OSS config missing: ...`（已实测） |
| `OSS_PROVIDER` | 可选 | `aliyun_oss` | |
| `OSS_PUBLIC_BASE_URL` | 可选 | 空 | 设了就用它拼公网地址，不设则返回签名地址 |
| `OSS_SIGN_EXPIRE_SECONDS` | 可选 | `3600` | 签名地址有效期（秒） |
| `TEST_DATABASE_URL` | 只跑测试用 | `sqlite:///:memory:` | `APP_ENV=test uv run pytest` 用 |
| `PROJECT_NAME` `VERSION` `API_V1_STR` `ALGORITHM` | 不用管 | Meblog / 1.0.0 / `/api/v1` / HS256 | |

**代码里根本没读的变量**（别浪费时间填）：`REDIS_URL`、`ALLOWED_HOSTS`、`DEBUG`。
`backend/.env.example` 原本把它们当必需项列着，现已挪进「当前代码根本不读取」说明段，并补齐了真正用到的
`SITE_URL` / `OSS_*` / `BACKEND_CORS_ORIGINS` / `TEST_DATABASE_URL`。

### 前端 `frontend/.env.local`

| 变量 | 本地是否必需 | 默认值 | 说明 |
|---|---|---|---|
| `REVALIDATE_SECRET` | 可选 | 未设 | 不设时 `/api/internal/revalidate` 一律 401。要缓存自动刷新就设成和后端 token 一致 |
| `NEXT_PUBLIC_SITE_URL` | 可选 | `http://localhost:3000` | metadataBase / canonical / OG 用 |
| `SITE_URL` | 可选 | 同上 | `NEXT_PUBLIC_SITE_URL` 的兜底 |
| `NEXT_PUBLIC_GITEE_ASSETS_BASE` | 可选 | 空 | 封面图兜底候选前缀，例 `https://gitee.com/<user>/<repo>/raw/main/covers` |
| `NEXT_PUBLIC_ENV` | 不用管 | 未设 | `test`→`.env.test`，`production`→`.env.production`，其它→`.env.local` |
| `NEXT_PUBLIC_API_BASE_URL` | **本地留空更好** | 空 → `/api/v1` | 留空走同源代理（免 CORS）；填了就是浏览器直连后端，必须同时配 `BACKEND_CORS_ORIGINS`。注意它是构建期注入，改了要重启 dev |
| `SERVER_API_BASE_URL` | 本地不用 | 空 | SSR 用的后端地址。开发默认 `http://127.0.0.1:8000/api/v1`，生产容器里要填服务名 |
| `API_ORIGIN` / `NEXT_PUBLIC_API_ORIGIN` | 本地不用 | 空 | 只在 `next build` 后决定 `/api/*` 转发目标；开发模式硬编码 127.0.0.1:8000 |
| `E2E_BASE_URL` | 只跑冒烟测试 | `http://127.0.0.1:3000` | `pnpm test:e2e:smoke` 用 |

## 5. 三个已实测的坑

1. **`.env.local` 是按当前工作目录找的**。`configs/local.py` 里写的是相对路径 `.env.local`，所以 `uv run uvicorn` 必须在 `backend/` 目录下执行；在项目根目录启动会静默用默认值，你会以为配置没生效。
2. **外部环境变量优先级高于 `.env.local`**。pydantic-settings 先看 `os.environ`。如果你的机器上别的项目往 shell 里注入过 `DATABASE_URL`，meblog 会直接连过去，而启动钩子会往那个库里建表。建议每次跑之前确认：`echo $env:DATABASE_URL`（应为空），并把 `DATABASE_URL` 写死在 `.env.local` 里。
3. **`next dev` 认 `PORT` 环境变量**。如果别的工具在你的 shell 里 export 过 `PORT`，前端会去监听那个端口而不是 3000（我这边就被一个 `PORT=3100` 顶到了 `EADDRINUSE`）。用 `pnpm dev --port 3000` 显式指定最稳。顺带：`NODE_ENV` 也别在 shell 里全局设成 `production`，`next dev` 会警告配置不一致。

## 6. `backend/create_tables.py` 和 `test_connection.py`

这两个脚本以前把一台公网测试库的地址和口令写死在源码里（仓库是公开的，等于凭据泄露），现在已改成**只从配置读** `DATABASE_URL`：环境变量优先，其次 `backend/.env.<APP_ENV>`。

本地一般用不上它们 —— 启动钩子会自动建表（`app/main.py` 的 `on_startup`）。要给 PostgreSQL 初始化时才需要：

```powershell
cd D:\code\ai\meblog\backend
# 先看连的是哪个库（打印时口令会被打码）
$env:APP_ENV = "local"
uv run python test_connection.py

# 确认无误后再建表；目标不是 SQLite/localhost 时必须显式加 --yes
uv run python create_tables.py --yes
```

`--yes` 是刻意加的一道闸：不加这个参数，脚本拒绝写入任何非本地库。`backend/migrate.sh` 同样不再内置默认口令，缺 `DATABASE_URL` 会直接报错退出。

> 遗留问题：旧凭据已经在 git 历史里（`e276dd4` 导入提交及其之前的对象），改代码不等于收回。**那台库的口令需要轮换**，并且要确认它是否还对公网开放。这一条需要你自己动手，我无法替你改服务器口令。详见 [meblog 体检与优化清单](https://github.com/bugooai/meblog) 对应任务文档 A 段。

## 7. 常用自检

```powershell
# 后端活着没
Invoke-RestMethod http://127.0.0.1:8000/health

# 前端代理通没通（应返回文章列表 JSON）
Invoke-RestMethod http://127.0.0.1:3000/api/v1/posts

# 发文后首页没更新？
#   首页是 ISR 缓存，revalidate = 180 秒；要么等 3 分钟，要么把第 4 节的 revalidate 三件套配上
```

后端测试：`cd backend; uv run pytest`（126 用例，当前 3 个历史失败用例见优化清单 C 段）。
前端构建：`cd frontend; pnpm run build`。

## 8. GitHub 推拉不通时（代理）

2026-10-14 在这台机器上实测到的现象：

| 目标 | 直连 | 走 `host.docker.internal:7897` |
|---|---|---|
| `github.com`（git 推拉走这里） | TCP 超时 21s | 200 / 1.5s |
| `api.github.com` | 200 / 0.37s | — |
| `codeload.github.com` | 301 / 0.55s | — |

所以「api.github.com 通」不等于「能 git push」，两件事分开测。

只给 github.com 配代理，别的流量照常，也不需要用完手动切回：

```powershell
# 你本机（Windows + Clash）
git config --global http.https://github.com.proxy http://127.0.0.1:7897
git config --global --unset http.https://github.com.proxy   # 撤销
```

```bash
# 容器里（Paperclip agent 环境），写在仓库级就够
git config remote.origin.proxy http://host.docker.internal:7897
git config --unset remote.origin.proxy                      # 撤销
```

端口以你 Clash 的 mixed 端口为准（这里是 7897；常见默认还有 7890）。验证：

```bash
git ls-remote https://github.com/bugooai/meblog HEAD   # 应该出 SHA
curl -s -o /dev/null -w '%{http_code}\n' https://www.baidu.com   # 不该被代理拖慢
```

外部控制器（`9090`）默认只监听 Windows 的 `127.0.0.1`，容器 `host.docker.internal:9090` 会直接被拒。想让容器里的 agent 查延迟/切节点，需要在 Clash 里打开「允许局域网连接」（`allow-lan: true`）；不开的话只有 git 这条路能用。

## 9. 代理白名单：实测枚举（2026-10-15）

### 先更正第 8 节末尾那句话

「开 `allow-lan` 就能让容器访问控制器」——**不完全对，实测过**。今天开了局域网连接之后：

| 端口 | 用途 | 从容器连 `192.168.65.254` |
|---|---|---|
| `7897` | mixed 代理（git 走这里） | **OPEN** |
| `9090` | 外部控制器（查节点/切节点） | **Connection refused** |

`allow-lan` 放开的是代理监听口。控制器是否跟着放开取决于 `external-controller` 绑的地址：写成 `127.0.0.1:9090` 就永远只在本机回环上。要让容器里的网管能查延迟/切节点，得把它改成 `0.0.0.0:9090`（或 `:9090`），**并且同时设 `secret`** —— 否则同一局域网内任何设备都能改你的路由。不设 secret 就别开。

### 该走代理的域名（枚举，不是通配）

只有这些**出过直连失败**，且失败的是「按天抖」：

| 域名 | 为什么进白名单 |
|---|---|
| `github.com` | 10-14 直连 TCP 超时 21s×3，git push 因此失败；今天直连 200/1.1s |
| `raw.githubusercontent.com` | 今天直连抖了一次 `000`（6s 超时），重试即恢复 |
| `codeload.github.com` | 随 `git clone`/release 下载一起抖 |
| `objects.githubusercontent.com` | release/LFS 资源，同上 |
| `api.github.com` | 一直没失败过，留着是因为它和上面同一条链路 |

### 明确**不要**进白名单的（代理只会拖慢）

同一台机同一时刻测的，直连 vs 走代理：

| 目标 | 直连 | 走 `7897` | 结论 |
|---|---|---|---|
| `bugoo-ai-dev.oss-cn-hangzhou.aliyuncs.com` | 0.31s | 1.94s | 慢 6.2 倍，别代理 |
| `meblog.bugooai.cn`（你自己的站） | 0.29s | 2.42s | 慢 8.3 倍，别代理 |
| `www.baidu.com` | 0.20s | 1.66s | 慢 8.3 倍，别代理 |
| `pypi.org` | 1.05s | 2.17s | 慢 2 倍，别代理 |
| `registry.npmjs.org` | 1.26s，3 轮全绿 | 今天抖过一次 `000` 超时 | 走代理反而出问题，别代理 |

10-14 那次 `pypi.org` 两条路都不通是**当天的抖动**，今天 3 轮 8 个目标 48 次请求全部成功（`uv` 因此现在可用）。所以别把「昨天不通」写成永久规则 —— 白名单要跟着实测走。

### 结论写法

`git config --global http.https://github.com.proxy ...` 这种**按主机**的配置就是这里要的形态：只有 github.com 走代理，npm/国内站点照常。它不需要「用完切回来」，因为它本来就没切走别的流量。真要覆盖 `raw.githubusercontent.com` 之类，就为每个主机各写一条 `http.<url>.proxy`，别用 `http.proxy` 全局值。

### 容器侧固化：`scripts/git-sync.sh`（直连优先，失败自动走代理）

规则来自上面的实测：直连 github 是**按天抖**，不是永久断，所以不写死「永远走代理」，也不需要谁手动切来切回。脚本把参数原样透传给 `git`，只有直连**网络类**失败才按 URL scope 换代理重试一次。

```bash
scripts/git-sync.sh push origin dev
scripts/git-sync.sh fetch --prune
scripts/git-sync.sh ls-remote https://github.com/bugooai/meblog HEAD
scripts/git-sync.sh probe          # 只测连通性，不动仓库
```

2026-10-15 05:55–06:05 UTC 在容器内实测：

| 场景 | 命令 | 真实结果 |
|---|---|---|
| 直连通 | `scripts/git-sync.sh ls-remote …/meblog HEAD` | `b8e035fcb109d88ed25f7be7c35c8c8056458ebc HEAD`，3s，日志标「未使用代理」 |
| 直连不通（模拟 10-14） | `GIT_SYNC_SKIP_DIRECT=1` 同上 | 自动走 `http://host.docker.internal:7897`，2s，**同一个 SHA** |
| 真推一次（代理路径） | `GIT_SYNC_SKIP_DIRECT=1 scripts/git-sync.sh push origin HEAD:refs/heads/nonexistent-check-branch` | `* [new branch]`，4s，走 `7897` |
| 真推一次（直连路径，收尾） | `scripts/git-sync.sh push origin --delete nonexistent-check-branch` | `- [deleted]`，7s，走直连；已确认远端无残留 |
| 两条路都不通 | `GIT_SYNC_PROXY_CANDIDATES="http://127.0.0.1:1 http://127.0.0.1:2" …` | `rc=128`，列出试过的每一条路，**不静默成功** |
| 非网络错误 | `… ls-remote …/definitely-not-a-repo-xyz-42 HEAD` | `Repository not found` → `rc=128` 原样冒泡，不用代理掩盖 |

要点：

- 代理只以 `-c http.https://github.com/.proxy=<url>` 的形式注入**当次命令**，npm / pypi / OSS / 你自己的站照常直连；跑完 `git config --global --get-regexp proxy` 仍然是空 —— **撤销方法就是不再调用脚本，零残留配置**。
- 每条路径最坏约 21s 断开（这是 10-14 记录到的「TCP 超时 21s」，即内核 connect 超时；`http.lowSpeedTime` 管不到连接阶段，只兜住「连上了但传不动」）。三条路全挂最多约 60s，然后非零退出。
- 认证失败 / 404 / non-fast-forward 一律不重试代理，避免把真实错误伪装成网络问题。
- 脚本默认代理候选是 `host.docker.internal:7897` 再 `192.168.65.254:7897`：这台容器里 `host.docker.internal` 解析成 IPv6（`fdc4:f303:9324::254`），v6 首包实测 7.9s、v4 实测 2.4s，所以留了 IPv4 兜底。

- 上表两条 push 测试是排障时的意外产物：本想用错误参数验证「非网络错误不重试」，结果 `--force-with-lease=nonsense` 被 git 当成合法 lease 名，分支真建出来了。已在同一个心跳里删除并验证（`git ls-remote --heads origin nonexistent-check-branch` 无输出）。顺带证明了代理与直连两条 push 路径都可用。

### Windows 侧配方（PowerShell，可直接粘贴）

**A. 常驻按主机代理**（最省事；只影响 `github.com`，别的流量照常，不需要「用完切回」）：

```powershell
git config --global "http.https://github.com.proxy" "http://127.0.0.1:7897"
git ls-remote https://github.com/bugooai/meblog HEAD    # 验证：应该出 SHA
git config --global --unset "http.https://github.com.proxy"    # 撤销
```

**B. 直连优先 + 失败自动走代理**（和容器侧同一条规则，写进 `$PROFILE` 后长期不用管）：

```powershell
function git-sync {
  param([Parameter(ValueFromRemainingArguments = $true)]$GitArgs)
  git @GitArgs
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[git-sync] 直连失败(rc=$LASTEXITCODE)，改用 Clash 代理重试一次"
    git -c "http.https://github.com.proxy=http://127.0.0.1:7897" @GitArgs
  }
}
```

用法 `git-sync push origin dev`；一条验证命令：

```powershell
git-sync ls-remote https://github.com/bugooai/meblog HEAD
```

> 诚实边界：网管的 cwd 在容器里，够不到这台 Windows 的文件系统，**上面两段 PowerShell 没有在实机执行过**。等价的 bash 逻辑（直连优先 / 代理重试 / 失败不静默）已按上表实测。请把验证命令的真实输出贴回 [CMP-4](/cmp/issues/CMP-4) 评论，作为 Windows 侧证据。

### 查延迟 / 切节点：现在做不到（如实记录，不含糊）

- 从容器测控制器：`host.docker.internal:9090` 与 `192.168.65.254:9090` 都是 **Connection refused**（`curl` exit=7），同一时刻 `7897` 两条路都 OPEN（v6 200/7.9s，v4 200/2.4s）。结论和 10-15 05:55 那次一致：**`allow-lan` 放开的是代理口，不是控制器口**。
- 要放开只能由布谷在本机改：`external-controller` 绑 `0.0.0.0:9090`（或 `:9090`），**并且同时设 `secret`**。不设 secret 就别开 —— 同局域网任何设备都能改路由。网管不动用户本机的 Clash 配置。
- 放开之后要补的证据是三条：`GET /version`、`GET /proxies`、`GET /proxies/{name}/delay`。在那之前不做「自动切出口节点」，git 这条链路只依赖 `7897` 是否可连，脚本的 probe 已经能证明这一点。
