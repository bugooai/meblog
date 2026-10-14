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

后端测试：`cd backend; uv run pytest`（66 用例，当前 3 个历史失败用例见优化清单 C 段）。
前端构建：`cd frontend; pnpm run build`。
