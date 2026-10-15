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

### 创建第一个账号

前端只有登录页，**没有注册页**，`ALLOW_REGISTRATION` 默认也是 `false`。
例外只有一个：`admins` 表为空时，第一次注册放行并且给管理员权限（否则没人能进后台）。

所以起完前端直接打开 <http://127.0.0.1:3000/login>：站里还没有账号时，这一页显示的是
「初始化站点」面板（用户名 / 邮箱 / 密码），提交后建号 + 登录 + 进后台一次做完。
判断依据是公开的 `GET /api/v1/auth/status`，它只回答两个布尔值，不吐账号数量和邮箱；
库里一旦有任何账号，面板消失，这一页变回普通登录。

不想开浏览器的话，命令行一样能用（走的还是同一条 `POST /auth/register`）：

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

外部控制器**只监听 `external-controller` 绑的地址**，默认在 Windows 的 `127.0.0.1` 上，所以从容器连它一定会被拒；而且**端口不是固定的 9090**（Clash Verge 默认 `9097`，Clash 内核/多数订阅配置默认 `9090`，以你自己配置里写的为准）。第 9 节有 2026-10-15 的实测更正：开 `allow-lan` 并不会顺带放开控制器。

## 9. 代理白名单：实测枚举（2026-10-15）

### 先更正第 8 节末尾那句话

「开 `allow-lan` 就能让容器访问控制器」——**不完全对，实测过**。今天开了局域网连接之后：

| 端口 | 用途 | 从容器连 `192.168.65.254` |
|---|---|---|
| `7897` | mixed 代理（git 走这里） | **OPEN** |
| 控制器端口（Clash Verge 默认 `9097`，不是 `9090`） | 外部控制器（查节点/切节点） | `9090` 与 `9097` **都是 Connection refused**（07:40 UTC 网管复测，1–3ms 内拒绝，无人监听） |

`allow-lan` 放开的是代理监听口。控制器是否跟着放开取决于 `external-controller` 绑的地址：写成 `127.0.0.1:9090` 就永远只在本机回环上。要让容器里的网管能查延迟/切节点，得把它改成 `0.0.0.0:<你实际用的端口>`（或 `:<该端口>`），**并且同时设 `secret`** —— 否则同一局域网内任何设备都能改你的路由。不设 secret 就别开。**先确认自己的端口再改，别照抄 9090**：Clash Verge 默认是 `9097`。改完要重启核心才生效（网管 07:38 / 07:40 两次复测 `9090` 与 `9097` 仍 refused，说明绑定还没改或核心没重启）。

### 该走代理的域名（枚举，不是通配）

只有这些**出过直连失败**，且失败的是「按天抖」。**`api.github.com` 不在其中 —— 见下面「禁止走代理」**（14:51 实测走代理返回 403，15:04 复测又变回 200：它是不稳定的，不是慢的问题）：

| 域名 | 为什么进白名单 |
|---|---|
| `github.com` | 10-14 直连 TCP 超时 21s×3，git push 因此失败；今天直连 200/1.1s |
| `raw.githubusercontent.com` | 今天直连抖了一次 `000`（6s 超时），重试即恢复 |
| `codeload.github.com` | 随 `git clone`/release 下载一起抖 |
| `objects.githubusercontent.com` | release/LFS 资源，同上 |

### 明确**不要**进白名单的（代理只会拖慢）

同一台机同一时刻测的，直连 vs 走代理：

| 目标 | 直连 | 走 `7897` | 结论 |
|---|---|---|---|
| `bugoo-ai-dev.oss-cn-hangzhou.aliyuncs.com` | 0.31s | 1.94s | 慢 6.2 倍，别代理 |
| `meblog.bugooai.cn`（你自己的站） | 0.29s | 2.42s | 慢 8.3 倍，别代理 |
| `www.baidu.com` | 0.20s | 1.66s | 慢 8.3 倍，别代理 |
| `pypi.org` | 1.05s → 14:51 复测 0.70s | 2.17s → 14:51 复测 1.15s | 直连略快，同样**别写死方向** |
| `registry.npmjs.org` | 0.90–2.34s（14:51 四轮） | 0.83–1.36s | **打平**。原「慢 2–8 倍，别代理」是单时刻样本，降级为「别写死方向」 |

**禁止走代理（比「不要」更硬，会随机报错）**：`api.github.com` —— 14:51 走 `7897` 连续 **403**（GitHub 按出口 IP 拒），直连 200/0.42s；我 15:04 复测走代理又是 5/5 **200**（0.84–2.6s）、直连仍 200（0.29–0.42s）。所以正确的说法不是「代理必挂」，而是**换节点就可能随机 403，且直连更快**：一旦 403 会直接打断认证/上传，比慢严重得多。哪天 `github.com` 挂了你手动强行走代理，也**只能给 `github.com` 这一个主机加代理**，`api.github.com`（REST、release 上传、部分认证流走它）必须留直连。`scripts/git-sync.sh` 已把它钉死：任何一次调用都额外传 `-c http.https://api.github.com.proxy=`（空值 = 禁用该主机代理），`GIT_SYNC_NEVER_PROXY_HOSTS` 可覆盖。

复测差异（2026-10-15 06:10 UTC，容器内）：`https://meblog.bugooai.cn` 现在**直连和走代理都失败**（`curl` exit=35，`SSL routines::unexpected eof while reading`，TLS 1.2/1.3 都一样），但 `http://meblog.bugooai.cn` 返回 200，443 TCP 也 OPEN。特征是「发出 Client Hello 后服务端不回应就断开」，属服务器 TLS/证书侧，**与代理无关，别据此改白名单**。上表那条 0.29s 应该是当时走的 80 或握手尚未坏。

10-14 那次 `pypi.org` 两条路都不通是**当天的抖动**，今天 3 轮 8 个目标 48 次请求全部成功（`uv` 因此现在可用）。所以别把「昨天不通」写成永久规则 —— 白名单要跟着实测走。

### 结论写法

`http.https://github.com.proxy` 这种**按主机**的写法是这里要的形态（`git -c` 一次性注入 或 `git config --global` 常驻都可以）。三条实测边界：

- **只有 `github.com` 进代理，`api.github.com` 绝不进**；npm / pypi / 国内站点照常直连。常驻写法不需要「用完切回」，因为它本来就没切走别的流量；要「用完就没了」就用一次性 `-c`，实测 `git config --global --get-regexp proxy` 与 `env` 里 `*_proxy` 都是 0 条。
- **别用光秃的 scope**：`-c http.https://.proxy=<url>`（只写 scheme）实测**完全不生效** —— git 没走代理，报的是连 `github.com` 失败而不是连代理失败。所以按主机写不是风格问题，是能不能生效的问题。
- **别用全局 `http.proxy`**：它会把 `api.github.com`、npm、OSS 一起拖进代理。实测 `-c http.proxy=http://127.0.0.1:1` 会让 `api.github.com` 变成「连不上 127.0.0.1」；再加上 `-c http.https://api.github.com.proxy=` 就恢复成 GitHub 自己的响应（当时是 403，15:04 复测是 200 —— 关键是**请求真的出到 GitHub 了，没被代理劫持**）。这就是脚本那条保险的原理。

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
| 真实使用（10-15 07:xx） | 得得在 CMP-3 用本脚本 `push dev` + `ff-push main` 各一次 | **都是第 1 步直连就过**（5–8s，未用代理），规则得到实战支持 |
| 真实使用（10-15 15:00–15:06） | 网管 `scripts/git-sync.sh push origin dev` 两次 | 两次直连都 **21s connect 超时**（正是 10-14 那个症状）**自动切 7897 后 5s 推上**：`8678e78..c8c3b0b dev`。全程没人切过代理，切完 `--get-regexp proxy` 仍 0 条 |
| 直连慢成功（15:05） | `scripts/git-sync.sh ls-remote … HEAD` | 直连**成功但花 35s**（同刻走代理 3s）→ 只写「直连优先」不够，还得允许失败快切 |
| 非网络错误 | `… ls-remote …/definitely-not-a-repo-xyz-42 HEAD` | `Repository not found` → `rc=128` 原样冒泡，不用代理掩盖 |

要点：

- 代理只以 `-c http.https://github.com/.proxy=<url>` 的形式注入**当次命令**，npm / pypi / OSS / 你自己的站照常直连；跑完 `git config --global --get-regexp proxy` 仍然是空 —— **撤销方法就是不再调用脚本，零残留配置**。
- 每条路径最坏约 21s 断开（这是 10-14 记录到的「TCP 超时 21s」，即内核 connect 超时；`http.lowSpeedTime` 管不到连接阶段，只兜住「连上了但传不动」）。三条路全挂最多约 60s，然后非零退出。
- 认证失败 / 404 / non-fast-forward 一律不重试代理，避免把真实错误伪装成网络问题。
- 脚本默认代理候选是 `host.docker.internal:7897` 再 `192.168.65.254:7897`：这台容器里 `host.docker.internal` 解析成 IPv6（`fdc4:f303:9324::254`），v6 首包实测 7.9s、v4 实测 2.4s，所以留了 IPv4 兜底。

- 上表两条 push 测试是排障时的意外产物：本想用错误参数验证「非网络错误不重试」，结果 `--force-with-lease=nonsense` 被 git 当成合法 lease 名，分支真建出来了。已在同一个心跳里删除并验证（`git ls-remote --heads origin nonexistent-check-branch` 无输出）。顺带证明了代理与直连两条 push 路径都可用。

### Windows 侧配方（PowerShell，可直接粘贴）

按 10-15 14:55 的验收口径重排：**A/B 都是 `-c` 一次性注入，不写任何配置文件**，所以「关闭」这一步天然不需要人工（实测 `git config --global --get-regexp proxy` 与 `env` 里 `*_proxy` 都是 0 条）。C 才是要常驻的情况，但它就不算零残留了。

**A. 一次性走代理拉一次 github（先跑这条取证）**：

```powershell
git -c "http.https://api.github.com.proxy=" -c "http.https://github.com.proxy=http://127.0.0.1:7897" ls-remote https://github.com/bugooai/meblog HEAD
git config --global --get-regexp proxy    # 验证零残留：这条应该没有输出
```

**B. 直连优先 + 失败自动走代理**（和容器侧同一条规则，写进 `$PROFILE`，长期不用管，同样零残留）：

```powershell
function git-sync {
  param([Parameter(ValueFromRemainingArguments = $true)]$GitArgs)
  git -c "http.https://api.github.com.proxy=" @GitArgs
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[git-sync] 直连失败(rc=$LASTEXITCODE)，改用 Clash 代理重试一次；api.github.com 仍强制直连"
    git -c "http.https://api.github.com.proxy=" -c "http.https://github.com.proxy=http://127.0.0.1:7897" @GitArgs
  }
}
```

用法 `git-sync push origin dev`；一条验证命令：

```powershell
git-sync ls-remote https://github.com/bugooai/meblog HEAD    # 应该第 1 步直连就出 SHA
```

`api.github.com.proxy=` 那个空值不是凑数的：实测它能把该主机从全局 `http.proxy` 里摘出来（不加它，全局死代理会让 `api.github.com` 变成「连不上代理」；加上就是 GitHub 自己的响应）。原因见第 9 节 —— `api.github.com` 走代理会**随机 403**（14:51 连续 403，15:04 又五连 200），不能和 `github.com` 同档处理。

**C. 只有你确实想常驻时才写配置**（只影响 `github.com` 这一个主机，不影响别的流量，但 `git config` 里会留一行）：

```powershell
git config --global "http.https://github.com.proxy" "http://127.0.0.1:7897"
git config --global --unset "http.https://github.com.proxy"    # 撤销
```

> 诚实边界：网管的 cwd 在容器里，够不到这台 Windows 的文件系统，**上面三段 PowerShell 没有在实机执行过**。等价的 bash 逻辑（直连优先 / 代理重试 / 失败不静默 / `api.github.com` 摘出代理）已按上面两节实测。请把 **A 的 SHA** 和 **A 第二条（`--get-regexp proxy`）应无输出**这两份真实结果贴回 [CMP-4](/cmp/issues/CMP-4)，作为 Windows 侧证据；跑过 B 的话把 `git-sync ls-remote` 的输出一起贴上。

### 查延迟 / 切节点：现在做不到（如实记录，不含糊）

- 从容器测控制器：`9090` 与 **`9097`（Clash Verge 默认端口）都 refused**，`curl` exit=7，1–3ms 内就被拒（无人监听）。同一时刻 `7897` 走 `-x` 实测 `https://github.com` → 200/3.7s。05:55、07:38、07:40、14:51 UTC 四个时间点结论一致：**`allow-lan` 放开的是代理口，不是控制器口**。
- `scripts/git-sync.sh probe` 现在**同时探 `9097` 和 `9090`** 两个控制器端口（可用 `GIT_SYNC_CONTROLLER_CANDIDATES` 覆盖），并区分三种结果：`curl exit=7` 没监听 / `401`·`403` 已放开且在要 secret（期望状态）/ `200` 已放开但**没有 secret**（危险，立刻设 secret）。
- 小坑记录：`curl http://<宿主>:7897/version` 返回 **400** 是正常的 —— `7897` 是 mixed 代理口，只接受带代理语义的请求，它不是控制器。查控制器要用 `curl http://<宿主>:<控制器端口>/version`，别拿这个 400 当「控制器通了」。
- 端口别写死：**如果**哪天要放开，改成 `0.0.0.0:<你的实际端口>` 并**同时设 `secret`**，改完重启核心。这条现在**不是待办**（见下）。
- 最终决定以布谷 **14:55** 那句为准：「我只需要网管能切换代理即可」。他 14:49 选的「开」**已被自己这条覆盖** —— 所以 `external-controller` 不改绑定、不设 secret、`9097` 保持关闭。（附带答复仍然有效：设了 secret 后 Verge 自带面板照常可用，它自己带 secret；要自己带 secret 的是第三方面板 / REST / WebSocket。）原确认卡 `cc687844` 已 withdraw，**任何人不要再以这件事要求布谷改 Clash，也不要把它当阻塞项**。网管不动用户本机的 Clash 配置。
- 放开之后要补的证据是三条：`GET /version`、`GET /proxies`、`GET /proxies/{name}/delay`（secret 只走 header，不进评论/文档/仓库）。在那之前不做「自动切出口节点」，git 这条链路只依赖 `7897` 是否可连，脚本的 probe 已经能证明这一点。
- **这件事已关闭，不是「暂停」**：布谷 14:49 说「先切换试试……然后关闭」，14:55 进一步明确只要路径级切换。哪天要恢复节点级切换，由布谷在 CMP-3 主动开口，届时先按第 10 节的「9097 是什么」重新确认，再谈放开。

## 10. 「切到代理 → 访问谷歌 → 关闭」这条实测走通（2026-10-15 14:51–14:54 UTC）

布谷的要求是这一句：切到代理的时候访问谷歌，然后关闭。下面是容器内真实跑的三步，**每一步都留了证据**。

### 先说结论

- 「用完立马切回本地」在这套写法下**不需要人工做**：代理只以 `-c http.https://github.com.proxy=...` 注入当次命令，`git config` 一个字都没写。实测切完之后 `git config --global --get-regexp proxy` = **0 条**，`env` 里 `*_proxy` = **0 条**。
- 但**谷歌本身不需要走代理**：同一时刻 `https://www.google.com/generate_204` 直连 **204 / 0.48s**，走代理 204 / 0.64s。要代理的从来只是 github 那一段（而且今天 github 直连更快，见下表）。
- 出口确实换了：直连外网 IP `116.149.183.80`，走 `7897` 出去 `188.253.120.78`。所以「切到代理」是真的换了路径，不是自我安慰。

### 复测数据（同机同刻，单位秒）

| 目标 | 直连 | 走 `host.docker.internal:7897` | 读法 |
|---|---|---|---|
| `https://github.com` | **0.76 / 0.98** | 2.10 / 2.74 / 3.82 | 今天直连快 2–4 倍 → 直连优先是对的 |
| `https://api.github.com` | **200 / 0.42** | **403** / 0.58–1.58 | GitHub 拦代理出口 IP：**这一条绝不能走代理** |
| `https://www.google.com/generate_204` | 204 / 0.48 | 204 / 0.64 | 谷歌今天直连就通，不是非要代理 |
| `https://www.youtube.com/` | 200 / 4.99 | 200 / 5.73 | 两边都慢，差异不在这条链上 |
| `http://meblog.bugooai.cn/` | **0.35** | 3.34 | 自有站走代理慢约 9 倍 |
| `https://www.baidu.com` | **0.17** | 1.28–1.50 | 国内站照常直连 |
| `https://registry.npmjs.org/-/ping` | 0.90–2.34 | 0.83–1.36 | **打平，谁快不稳定** |
| `https://pypi.org/simple/flask/`（HEAD） | **0.70** | 1.15 | 直连略快 |

对第 9 节那份枚举的一处**降级修正**：那里写「`registry.npmjs.org` 明确不要走代理（慢 2–8 倍）」，是**单时刻样本**。这轮 4 次采样 npm 是 0.90/1.19/2.34（直连）对 0.83/0.96/1.36（代理），基本打平。所以正确说法不是「npm 别走代理」，而是：**npm/pypi 这种两条路都在 1–2 秒内的目标，写死任何一条都是白亏** —— 这正是「直连优先 + 只有网络类失败才走代理」比手动开关更稳的原因。国内站（自有站、百度）走代理慢 2–9 倍这条仍然成立。

新增一条硬结论（第 9 节没有的）：**`api.github.com` 走代理是 403**，不是慢，是被 GitHub 按出口 IP 拒。所以就算哪天 github 挂了要强行走代理，也只能给 `github.com` 这一个域名加代理，`api.github.com`（REST / 上传、GCM 认证走它）必须留直连。

**网管复测（15:03–15:04 UTC，同一台容器）**：上面那条「`api.github.com` 走代理 403」我复测时**没有复现** —— 走代理 5/5 是 200（0.84–2.6s），直连 3/3 是 200（0.29–0.42s）。所以这条从「硬结论」降级为「**换节点会随机 403**」：它比慢更糟（会直接打断认证/上传），因此 `api.github.com` 仍然**禁止进代理**，脚本那条 `-c http.https://api.github.com.proxy=` 保险继续留着，但理由写对。顺带又抓到一次抖动：15:03 直连 `github.com` 同一分钟内 **一次 12s 超时 + 两次 0.86/1.00s 成功**，而同一时刻走代理是 4.9s/7.8s（也超时过一次 10s）。这就是「按分钟抖」而不是「按天抖」，也是直连优先 + 失败自动走代理比手动开关稳的原因。

### 手动复现这三步（bash / 容器内）

```bash
# 1) 切之前：确认没有残留
git config --global --get-regexp proxy | wc -l    # 期望 0

# 2) 切到代理，拉一次 github（只对本次命令生效）
GIT_SYNC_SKIP_DIRECT=1 scripts/git-sync.sh ls-remote https://github.com/bugooai/meblog HEAD
#   [git-sync] 重试：http://host.docker.internal:7897
#   2f34820...  HEAD
#   [git-sync] 成功：走 http://host.docker.internal:7897，1s（仅本次命令生效，未写 git config）

# 3) 关闭 = 什么都不用做，再验一次残留 + 直连照常
git config --global --get-regexp proxy | wc -l    # 仍然是 0
scripts/git-sync.sh ls-remote https://github.com/bugooai/meblog HEAD
#   [git-sync] 第 1 步：直连 … 成功：直连，1s，未使用代理
```

只想验证「代理这条路能不能出谷歌」，用 `curl -x` 就够了，它不会写任何配置：

```bash
curl -sS -x http://host.docker.internal:7897 -o /dev/null -w '%{http_code} %{time_total}s\n' https://www.google.com/generate_204
curl -sS -x http://host.docker.internal:7897 https://api.ipify.org   # 出口 IP 变成节点的 IP
```

### 9097 是什么，以及它和「切换代理」是两件事（已定：这条不做）

14:55 UTC 布谷问：「9097 是做什么的。我只需要网管能切换代理即可」。分工说清：

| 层 | 走哪个口 | 能做什么 | 网管现在能不能做 |
|---|---|---|---|
| **用不用代理**（切换出口路径） | `7897` mixed 代理口 | 让 github 这次请求走 Clash 出去，用完不残留 | **能**，就是第 8/9/10 节那条链 |
| **走哪个节点**（切出口节点 / 查延迟） | `9097`（Clash Verge 默认外部控制器；旧文档写的 9090 是 Clash 内核默认） | REST `GET /proxies`、`PUT /proxies/{组}`、`GET /proxies/{名}/delay` | **不做**（见下） |

9097 就是那个**外部控制器**：一个 HTTP 管理接口，dashboard 也靠它取数据。它跟「开不开代理」无关 —— 你手动点系统代理开关，走的就是 `7897`，压根不碰 9097。

**决定（布谷 14:55）**：只要「切换代理」这一层，**不改 `external-controller` 绑定、不设 secret、不放开 9097**。所以：

- 网管职责固定为路径级切换：什么时候走 `7897`、走完零残留。这条已实测，不需要布谷动 Clash 的任何设置。
- 「查节点延迟 / 自动挑最快节点」明确**不在范围内**，别再为这事要求布谷改 Clash（原 `cc687844` 卡片已 withdraw，`docs` 里凡写「要放开就改 0.0.0.0」的都只是留档，不是待办）。
- 顺带记录 14:51 与 14:56 两次实测：`192.168.65.254` 的 `9090`/`9097` 都 refused，`7897` OPEN。同一时刻 github 走代理从 2.1–3.8s（14:51）变成 **1.02s**（14:56）—— 又一次证明「谁快」每次都不同，所以规则只能是直连优先 + 网络类失败才走代理，而不是写死方向。
- 如果哪天要做节点级切换，前提仍然是：`external-controller` 改 `0.0.0.0:<实际端口>` **同时**设 `secret`，之后补三条证据 `GET /version`、`GET /proxies`、`GET /proxies/{name}/delay`（secret 只走 header，不进日志、不进仓库）。
