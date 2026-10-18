# meblog 线上部署核对（meblog.bugooai.cn）

2026-10-14 实测的结论，全部来自对线上的真实请求，不是读代码猜的。

## 当前线上状态

| 项 | 实测结果 |
|---|---|
| 域名解析 | `meblog.bugooai.cn` → `116.62.176.216`（和 PRD/脚本里那个泄露口令的库同一台机） |
| Web 服务 | `Server: nginx/1.18.0 (Ubuntu)`，只开了 **80**；`https://` 无响应，`:9000` 外部无响应（后端没暴露公网，这点是对的） |
| 首页 `/` | 200，62 KB，文章列表正常渲染 |
| `/api/v1/posts` | 200，真实文章数据 |
| `/sitemap.xml` | 200，**17 条 `<loc>` 全部是 `http://localhost:3000/...`** |
| `/robots.txt` | 200，`Sitemap: http://localhost:3000/sitemap.xml` |
| `/feed.xml` | 200，`<link>` 也全是 `http://localhost:3000/...` |
| 首页 `<head>` | canonical / `og:*` / `twitter:*` / JSON-LD **一个都没有** |

### 2026-10-18 04:00 UTC 复测（只读；本轮 `main`=`37fea66`、`dev`=`a6b67d2`，线上一个字没动）

上表是 2026-10-14 的快照，其中三行已经**不再成立** —— 服务器上那五步后来真被执行过了：

| 项 | 2026-10-14 | 2026-10-18 实测 |
|---|---|---|
| `/robots.txt` | `Sitemap: http://localhost:3000/sitemap.xml` | `Sitemap: http://meblog.bugooai.cn/sitemap.xml` ✅ |
| `/sitemap.xml` | 17 条 `<loc>` 全是 localhost | `<loc>` 全是 `http://meblog.bugooai.cn/...` ✅ |
| `/` | 200 | 200，`Server: nginx/1.18.0 (Ubuntu)`，1.23 s |
| `GET /api/v1/auth/status` | 路由不存在 | 200 `{"needs_bootstrap":false,"allow_registration":false}` —— v11 的登录初始化入口已在线，且库里已有账号 |
| `GET /api/v1/admins` | — | 401（路由在、要鉴权）—— A 段加固已在线 |
| `POST /api/v1/auth/change-password` | — | **404** —— 「登录后自己改口令」仍未部署（下面「还没解决的」第 6 条） |
| `GET /admin/settings/password` | — | **404** —— 后台改密页同上 |
| `GET /api/v1/openapi.json` | 没查过 | **200 / 42 KB 公开可读**，而 `/docs` 是 404（下面第 7 条） |
| `https://` | 无响应 | 仍不通：`TLS connect error: unexpected eof while reading` |

读出来两句话：**站点地址那条已经真修好了**（不再等于「告诉 Google 去爬它自己的机器」）；但**「忘了口令只能找运维」这条线上仍然成立** —— 改密接口和改密页都没上线，所以拿到一次性口令的人自己换不掉它。

> **这张表是发版前的快照。** 同日 13:38 UTC 运维完成发版（线上 = `main` `5c0229b`）之后我又复测了一遍：`change-password`、`/admin/settings/password`、`openapi.json` 三行都已经变了，第二句结论也不再成立 —— 见下面「本次发版（2026-10-18）」里的发版后复测。

## 合入口径（2026-10-17 起，github 侧 CI）

- `dev` → `main` 仍然只做 `git merge --ff-only`（CMP-7 已经按这条路走过一次，不改这里的口径）。
- ff 之前先看 CI：**`origin/dev` 最新提交那个 run 必须绿**。文件是 `.github/workflows/ci.yml`，现在里面两条 job：

| job | 拦什么 | 本地复跑同一条命令 | `timeout-minutes` |
|---|---|---|---|
| 容器名拼写门禁 | compose 引用侧的服务名和 `container_name` 对不上（引用侧多一个 m 那个旧拼法） | `bash scripts/check-container-name-spelling.sh` | 5 |
| 前端类型检查 | 前端 TS/TSX 的类型错；顺带挡住「改了依赖没提交锁文件」 | `bash scripts/check-frontend-types.sh`（冷启动加 `--install`） | 10 |

- 两条 job 各自独立、各有各的 timeout：类型检查要冷装 543 个包再跑全量 `tsc`，比拼写门禁慢一个量级，挤在一个 job 里等于让 4 秒能跑完的门禁陪着等几分钟。
- 合入前本地把这两条都跑一遍，别等 Action 告诉你。检查逻辑都在 `scripts/` 里，CI 调的就是同一条命令，口径不会漂。
- CI 红就不合。真要例外，先在工单上写清理由再动门禁；不要为了让 CI 变绿去放宽匹配、整目录排除、关 `tsconfig` 的 `strict`，或者往源码里塞 `@ts-ignore`。
- 拼写门禁拦的就是这类改动：compose 引用侧的服务名多写了一个字母 m，和 `container_name` 对不上 —— DNS 要等约 2 秒才回 SERVFAIL，页面照样 200，只是每个 SSR 请求白等一次（线上 `/` 因此 4.02 秒，`5cc24e6` 一次修掉 15 处）。
- 类型检查为什么要先 `next typegen`：`frontend/next-env.d.ts` 里 import 了 `.next/types/routes.d.ts`，而 `.next/` 不进 git，CI 冷 checkout 没有这份路由类型；`tsconfig.json` 的 include 又带了 `.next/types/**/*.ts`。脚本里已经带上这一步，本地不用手动跑。
- 前端工具链版本：CI 钉 **pnpm 9.15.9 + node 20**，和 `frontend/Dockerfile` 里那套完全一致 —— 这条 job 检查的就是「将要装进镜像发出去的那份依赖树」，版本一致才谈得上门禁。装依赖只用 `pnpm install --frozen-lockfile`。
- 两个别顺手改的地方（都是 2026-10-17 实测出来的）：**别把 pnpm 升到 10+**，pnpm 10 起默认拒绝跑依赖的 build 脚本，`--frozen-lockfile` 会直接报 `ERR_PNPM_IGNORED_BUILDS`（`sharp@0.34.5` / `unrs-resolver@1.11.1`）—— `frontend/Dockerfile` 第 15-17 行的注释记的是同一个坑；这条 job 第一次落地就是红在这一步，改成和 Dockerfile 同版本之后才绿。**别往 `frontend/package.json` 里加 `packageManager` 字段**，加了之后 `--frozen-lockfile` 会报 `ERR_PNPM_FROZEN_LOCKFILE_WITH_OUTDATED_LOCKFILE`（pnpm 12 要把这个字段记进锁文件，于是认定现有锁文件过期），所以版本只钉在 workflow 里，锁文件一个字没动。
- 两条 job 的失败信息都只给 `path:line:col`，不回显命中的源码行 —— 仓库和 Action 日志都是公开的。
- eslint / ruff 还没进 CI：eslint 基线没量出来（`eslint .` 在共享盘的工作区 240 秒没跑完，exit 124 是我们自己 timeout 的），ruff 连依赖和 `[tool.ruff]` 配置都还没有。各自量完基线再一条一条加进来，见 CMP-15。

## 本次发版（2026-10-15，`main` <= `dev`）

`origin/main` 之前停在 `b8e035f`，这次把 `dev` 整条历史快进合过去。线上要重新构建镜像才会拿到下面这些：

| 变化 | 影响 |
|---|---|
| `SITE_URL` 没配时 sitemap/robots/RSS 全输出 `localhost` | 前端 `getSiteUrl()` 改成运行时 `SITE_URL` 优先，compose 把值接进容器 |
| 首页 / 文章页没有任何 `og:` 和 JSON-LD | `WebSite` / `BlogPosting` / `BreadcrumbList` / `Person` 全部就位，og:image 有兜底 |
| `/about` 是纯客户端页，服务端 HTML 里没有作者信息，还写死了一套别人的履历 | 改成服务端渲染 + `Person` JSON-LD，没配的栏目直接不渲染 |
| 公开注册会白送管理员权限 | `is_admin` 由调用方决定，只有空库第一个账号是管理员；加管理员只能管理员来做 |
| 新装的站只能用 curl 建第一个账号 | 登录页在账号表为空时显示「初始化站点」面板，建完自动登录进后台 |
| 图片签名地址会过期 | 配了 `OSS_PUBLIC_BASE_URL` 就发永久地址（现在留空，行为不变） |

服务器上按这个顺序做（我没有那台机的 SSH，这五步得你来，或者给我一条可用的通道）：

```bash
cd <仓库目录>
# 0) 先确认 origin/dev 最新提交 CI 绿（见上面「合入口径」）
# 0.1) 取码：这台机的 origin 是 gitee 且没有 main 分支，别照抄 origin ——
#      见下面「服务器上取码这件事（2026-10-18 实测）」
git fetch github && git checkout main && git merge --ff-only github/main

# 1) compose 插值用的根 .env（首次）
cp .env.example .env && $EDITOR .env        # 至少把 SITE_URL 填对

# 2) 后端自己的 env
$EDITOR backend/.env.production             # SITE_URL + FRONTEND_REVALIDATE_URL/TOKEN
ls frontend/.env*                           # 有 .env.local 就把 NEXT_PUBLIC_SITE_URL 从里面删掉（它会盖住 .env.production）

# 3) 重建（前端必须 --build，后端只需重启）
docker compose -f docker-compose-frontend-production.yml -p meblog-prod up -d --build
docker compose -f docker-compose-backend-production.yml -p meblog-prod up -d

# 4) 验证：见下面「配完怎么验」四条
```

### 服务器上取码这件事（2026-10-18 运维发 `5c0229b` 时实测；我原来写的那条命令在这台机上走不通）

原来这里写的是 `git fetch origin && git merge --ff-only origin/main`。**在那台机上是错的**：

| 事实 | 实测 |
|---|---|
| 服务器仓库 `/root/code/projects/meblog` 的 `origin` | 指向 **gitee**（`gitee.com/AhernLi-ai/meblog.git`）：`git ls-remote origin` 只有 `refs/heads/dev`=`283307a`（陈旧），**没有 `main`** |
| `github` 远端（`github.com/bugooai/meblog`） | **时通时不通**：一次 `ls-remote` 拿到 `main`=`dev`=`5c0229b`，随后两次 `fetch` 分别失败于 `curl 16 HTTP2 framing layer`、`curl 28 Failed to connect to github.com port 443 after 129566 ms` |
| 国内源 | gitee / npmmirror / aliyun-pypi / tsinghua-pypi / `docker.m.daocloud.io` 全部可达（`daemon.json` 的 registry-mirror 就是 daocloud） |

结论：权威源（GitHub）在这台机上**不是稳定可达**，而稳定可达的那个（gitee）**当前不是权威源**。两条路，本次走的是 B：

- **A. 把 gitee 同步成权威源的镜像**（`main`、`dev` 都推上去），之后服务器上 `git fetch origin` 就够用。这与「运维负责 GitHub/Gitee 发布同步」那条分工对得上，也是长期正确的做法 —— gitee 一天不同步，A 路就一天不成立。
- **B. bundle 送过去**（不依赖服务器访问 GitHub）：

```bash
# 本侧（能稳定访问 GitHub 的机器）
git bundle create meblog-main-<sha>.bundle main
git bundle verify meblog-main-<sha>.bundle      # 要看到 okay + records a complete history
git bundle list-heads meblog-main-<sha>.bundle  # 记下 SHA
sha256sum meblog-main-<sha>.bundle
scp meblog-main-<sha>.bundle root@<server>:/root/tmp/<工单目录>/

# 服务器侧
sha256sum /root/tmp/<工单目录>/meblog-main-<sha>.bundle   # 必须与本侧逐字节一致
git bundle verify /root/tmp/<工单目录>/meblog-main-<sha>.bundle
cd /root/code/projects/meblog
git fetch /root/tmp/<工单目录>/meblog-main-<sha>.bundle main
git merge-base --is-ancestor main FETCH_HEAD && echo "ff 可行" || echo "有分叉：停手，别强推"
git checkout main && git merge --ff-only FETCH_HEAD
git status --porcelain -uno                              # 必须是空的
```

`git merge-base --is-ancestor` 那一步不能省：它是「纯快进、不需要强推、不需要改历史」的唯一判据。本次实测服务器原 `main`=`2f34820`、原 `dev`=`5cc24e6`，两条都是 YES。bundle 落在 `/root/tmp/<工单目录>/`（仓库外，不进 git），里面不含任何凭据。

**线上库已经有账号了，所以登录页不会显示初始化面板** —— 它只在账号表为空时出现（新部署或重装才用得上）。

## 本次发版（2026-10-18，`main` <= `dev`）

布谷在卡片 `0dbedb01` 里选了「先发版、他自己在后台改口令」，所以这一批的重点是**让他以后不再需要任何人帮他重置口令**。`dev` 比上一版 `main`（`37fea66`）多出来的、和线上行为有关的部分：

| 变化 | 影响 |
|---|---|
| `POST /api/v1/auth/change-password`（`b2b8ecd`） | 知道旧口令就能自己换：先验旧口令（错 → 401），新口令沿用 `min_length=8`，与旧口令相同 → 400 |
| 后台 `/admin/settings/password`（`b2b8ecd`） | 改密入口进设置页，界面上写明「其它设备不会立刻掉线」（已签发的 JWT 到自然过期才失效） |
| `backend/reset_admin_password.py`（`b2b8ecd`） | 运维侧一次性重置：口令只从 stdin/环境变量进、打印只有前缀+长度、非本地库要 `--yes`、**账号不存在就停手**。CMP-10 那次是把脚本 `docker cp` 进容器临时跑的，发版之后不必再那样做 |
| `EXPOSE_OPENAPI`（2026-10-18） | 生产/测试默认**不出** `/api/v1/openapi.json`，本地默认出。上一版线上这个地址不用登录就返回 42 KB 全量路由 |
| `test_posts.py` 三条过时用例改成断言现在的设计（`365c1d6`） | 后端全量 **166 passed / 0 failed**（2026-10-18 本地实测，`APP_ENV=test`）—— 第一次没有已知失败项 |

服务器上的动作和上一批基本一样（见上面「本次发版（2026-10-15）」那五步），只有两处不同：

- **后端这次必须重建镜像**，不能只 `up -d`：`reset_admin_password.py`、`change-password` 路由和 `EXPOSE_OPENAPI` 都在镜像里，不是环境变量能带进去的。
- 前端同样要 `--build`：`/admin/settings/password` 是新路由，而 `NEXT_PUBLIC_*` 是构建期烘进产物的。

发版后的四条验收（我在容器外只读也能跑，用来复核运维的结果）：

```bash
curl -s -o /dev/null -w 'change-password=%{http_code}\n' -X POST \
  -H 'Content-Type: application/json' -d '{}' \
  http://meblog.bugooai.cn/api/v1/auth/change-password   # 空 body 期望 422；422 或 401 都说明路由已上线，只有 404 = 没发上去
curl -s -o /dev/null -w 'password-page=%{http_code}\n' \
  http://meblog.bugooai.cn/admin/settings/password       # 期望 200
curl -s -o /dev/null -w 'openapi=%{http_code}\n' \
  http://meblog.bugooai.cn/api/v1/openapi.json           # 期望 404（默认不出文档）
curl -s http://meblog.bugooai.cn/api/v1/auth/status      # 期望 {"needs_bootstrap":false,...}
```

**这四条 2026-10-18 已经跑过两遍**（运维在服务器侧、我在容器外只读），线上现在就是 `main` = `5c0229b`：`change-password` 空 body → **422**、合法形状 body 无 token → **401**；`/admin/settings/password` → **200 / 21306 B**；`/api/v1/openapi.json` → **404 / 22 B**（发版前是 `200 / 42376 B`）；`auth/status` 不变；`/`、`/login`、`/api/v1/posts`、`robots.txt`、`sitemap.xml` 全部无退化（`<loc>` 仍是域名，`localhost` 0 条）。443 仍不通，属 [CMP-5](/cmp/issues/CMP-5)。

两处口径要记住，免得下次自己吓自己：

- **用空 body 探 `change-password` 会得到 422 而不是 401**：处理函数把 `current_user` 声明成 `Optional[Admin]`，401 是在函数体里抛的（`backend/app/api/auth.py:46`），而 FastAPI 先校验 `PasswordChangeRequest` 再进函数体。所以 422 与 401 都证明路由活着。副作用：未登录调用方能从 422 的 detail 里看到字段名（`old_password` / `new_password`）—— 关掉 `openapi.json` 不等于 schema 完全不可见，这条按「可接受」记，不值得为它改接口形状。
- **`/admin/settings/password` 那个 200 是 Next 的 RSC 外壳，不是渲染好的表单**：HTML 里没有「登录口令 / 新口令」这些字（页面是 client component，登录态由 `AdminGuard` 在浏览器里判）。所以要配对照组才算证明路由真进了构建：`/admin/settings/nope-12345` → **404**，密码页 → **200** 且 HTML 里出现 `password` 标识（对照组 0 次）。表单实际长什么样只有布谷登录进去才知道 —— 我没有、也不会拿他的口令去试：那会写 `last_login_at`，是一次线上状态变更。

发版成功后布谷只需要做一步：用 CMP-10 那串一次性口令登进 `http://meblog.bugooai.cn/login`，到 `/admin/settings/password` 自己设新口令 —— **口令不进工单、不进附件、不进聊天记录**，也不需要第二个人知道明文。改完，那串一次性口令当场失效（同一行的哈希被覆盖）。

两件事互相独立，别混：删掉 CMP-10 里那两条含明文的评论**不会**让口令失效（布谷选的是「只删评论、不换口令」）；他自己改口令才让它失效。两件都做才算收口。另外这次改口令仍然在明文 HTTP 上传一遍 —— 443 还没通（[CMP-5](/cmp/issues/CMP-5)），不在本批范围里。

## 两个独立问题

### 1）站点地址没配 —— 优先级最高

搜索引擎现在拿到的是 `localhost` 链接：提交 sitemap 等于让 Google 去爬它自己的机器；RSS 订阅者点进任何一条都是 `localhost:3000`。这一条不修，B 段 SEO 做得再好都是零。

修法（两台容器各加，值必须完全一致）：

- 后端 `backend/.env.production`：`SITE_URL=http://meblog.bugooai.cn`
- 前端 `frontend/.env.production`：`NEXT_PUBLIC_SITE_URL=http://meblog.bugooai.cn` + `SITE_URL=http://meblog.bugooai.cn`

前端那两行是 `NEXT_PUBLIC_` 前缀，**必须重新构建镜像**才生效：

```bash
docker compose -f docker-compose-frontend-production.yml -p meblog-prod up -d --build
docker compose -f docker-compose-backend-production.yml -p meblog-prod up -d
```

逐项模板见 `backend/.env.production.example`、`frontend/.env.production.example`。

### 2）线上跑的是旧构建，没有结构化数据

首页没有任何 `og:` / JSON-LD，说明线上还是 `main`（`b8e035f`）那一版。`WebSite`/`BlogPosting`/`BreadcrumbList`、og:image 兜底、作者页 SSR、登录页初始化入口这些现在都已经在 `dev`，2026-10-15 你选了「发版」，`main` 已经合过去了 —— 见下面「本次发版」一节。**代码合上去只是第一步，线上不重新构建镜像就还是旧行为。**

## 站点地址为什么光写 `.env.production` 不够（2026-10-15 实测）

这次配 `SITE_URL` 踩到两个叠在一起的坑，都在前端：

1. **`NEXT_PUBLIC_*` 是构建时烘进产物的字面量，运行时改环境变量对它无效。**
   实测：容器里给了正确的 `SITE_URL`，`canonical` / `robots.txt` 仍然输出构建时烘进去的 `http://localhost:3000`。
   现在 `frontend/app/lib/seo.ts` 的 `getSiteUrl()` 改成 **`SITE_URL` 优先、`NEXT_PUBLIC_SITE_URL` 兜底**：这些地址全都只在服务端渲染里用（`layout.tsx`、`robots.ts`、`sitemap.ts`、`/feed.xml`、文章页），服务端读得到普通环境变量，所以改成运行时说了算 —— 以后换域名不用再重构建镜像。浏览器端如果哪天要用，仍走 `NEXT_PUBLIC_`。
2. **Next 读 env 文件的优先级是 `process.env` > `.env.production.local` > `.env.local` > `.env.production` > `.env`。**
   也就是说服务器上 `frontend/` 里只要残留一个 `.env.local`，它就能盖住你精心写好的 `.env.production`。部署前 `ls frontend/.env*` 看一眼，`NEXT_PUBLIC_SITE_URL` 别留在 `.env.local` 里。

compose 已经把两边都接上了（`docker-compose-frontend-production.yml`）：`build.args` 传 `NEXT_PUBLIC_SITE_URL`，`environment` 传运行时的 `SITE_URL` / `SERVER_API_BASE_URL` / `REVALIDATE_SECRET`，值从根目录 `.env` 插值（模板见 `.env.example`）。
**后端 compose 故意没加 `SITE_URL`**：pydantic-settings 不会因为环境变量是空串就退回 `.env` 文件（`env_ignore_empty` 默认 False），传一条 `SITE_URL=` 反而会把 `backend/.env.production` 里配好的值清成空。后端继续只读它自己的 `.env.production`。

## 一个会咬人的坑：revalidate 走域名不通

`/api/internal/revalidate` 是**前端**的 Next 路由，但 nginx 把域名的 `/api/*` 整段转给了 FastAPI。实测：

```
POST http://meblog.bugooai.cn/api/internal/revalidate
→ 404  {"detail":"Not Found"}     # 这个 JSON 形状是 FastAPI 的默认 404，不是 Next 的
```

所以后端的通知地址必须写**容器间地址**，绕开 nginx：

```
FRONTEND_REVALIDATE_URL=http://meblog-frontend-prod:3000/api/internal/revalidate
FRONTEND_REVALIDATE_TOKEN=<等于前端 REVALIDATE_SECRET>
```

容器名来自 `docker-compose-*-production.yml`（`meblog-backend-prod` / `meblog-frontend-prod`，都在 external 网络 `common-network` 上）。前端生产映射是 `9001:3000`，后端是 `9000:8000`，容器内部仍听 3000 / 8000。

## 配完怎么验（对着线上跑，四条全绿才算好）

```bash
curl -s http://meblog.bugooai.cn/robots.txt | grep Sitemap
curl -s http://meblog.bugooai.cn/sitemap.xml | grep -c "<loc>http://meblog.bugooai.cn"
curl -s http://meblog.bugooai.cn/feed.xml | grep -c "http://localhost"      # 期望 0
curl -s http://meblog.bugooai.cn/ | grep -Eo '(rel="canonical"|og:url|og:image|application/ld\+json)' | sort -u
```

## 图片上传（OSS）

现在上传一定是 500，因为 `OSS_*` 四项没配：

```
POST /api/v1/files/upload  →  OSS config missing: OSS_ENDPOINT/OSS_ACCESS_KEY_ID/OSS_ACCESS_KEY_SECRET/OSS_BUCKET
```

要配的四项 + 两项可选在 `backend/.env.production.example` 末尾。**AccessKey 只写在服务器上，别贴进仓库、Issue 或聊天**；用只授权这个 bucket 的 RAM 子账号，不要用主账号。配完这样验：

```bash
# 1) 拿管理员 token
curl -s -X POST http://meblog.bugooai.cn/api/v1/auth/login \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'username=<你>&password=<你>' | python3 -c 'import json,sys;print(json.load(sys.stdin)["access_token"])'
# 2) 传一张图（把 <TOKEN> 换成上面输出）
curl -s -X POST http://meblog.bugooai.cn/api/v1/files/upload \
  -H "Authorization: Bearer <TOKEN>" -F 'file=@/tmp/test.png'
# 期望 201，返回体里有 oss_url / 签名地址；再用浏览器打开那个地址能出图才算通
```

### 本地已实测跑通（2026-10-14，`dev`）

四项 key 填进 `backend/.env.local`（不进仓库）之后，本地 8000 + 3000 整条链实测：

| 环节 | 结果 |
|---|---|
| `POST /api/v1/files/upload` | 201，对象真进了 bucket |
| 返回的 `signed_url` | 200，字节和上传内容一致 |
| 不带签名的直链 `url` | 403 —— bucket 是私有的，只有签名地址出得了图 |
| 文章页 `og:image` / `twitter:image` | 签名地址，`twitter:card=summary_large_image`，抓取得到 200 |
| JSON-LD `BlogPosting.image` | 同一个签名地址 |
| `feed.xml` 的 `media:content` | 同一个签名地址，抓取得到 200 |

这条链以前是坏的：封面在库里存的是 `oss://bucket/key`，只有浏览器里那段 JS 才会换成签名地址，而爬虫不执行 JS —— 微信/Twitter 抓到的就是一张坏图。现在换签名发生在服务端渲染阶段（`frontend/app/lib/seo.ts` 里的 `metadataImageUrl`）。

三个必须知道的约束：

1. **bucket 私有 = 图片只能靠签名地址活着**，而签名会过期（`OSS_SIGN_EXPIRE_SECONDS`，默认 3600 秒）。所以前端取签名时把数据缓存压到 300 秒，必须明显短于过期时间，否则页面会发出一条已经失效的链接。把签名地址放进长期存在的地方（收藏、RSS 阅读器缓存几天的条目、别人的截图）迟早图裂。要根治就给 bucket 开公共读或挂 CDN，然后填 `OSS_PUBLIC_BASE_URL`，图片地址不再带签名也不会过期。
2. **对象 key 必须一字不差**。key 里日期是按年/月/日分层的目录，少一层、多一个字符都是 `NoSuchKey`。以前这种坏引用能静默存进库（页面只是图裂，没人会发现爬虫拿到的卡片是空白的），现在保存文章/项目/关于页/站点设置时后端会先确认对象真的存在，不存在直接 400（`backend/app/services/storage.py` 的 `prepare_media_value`）。
3. **签名地址是能力，不是权限**。它谁拿到谁能看图，且 `/files/signed-url` 匿名可调用（已挡跨 bucket）。bucket 里不要放你不想公开的对象。

### 上传路径已加固（2026-10-14，`dev`）

配 key 之前先把代码里两个真问题修了，并补了 33 条**不需要密钥就能跑**的测试（`backend/tests/test_file_upload.py`）：

| 问题 | 原来 | 现在 |
|---|---|---|
| 大文件直接把内存吃穿 | `await file.read()` 整份读进内存，无上限 | 分块读 + `MAX_UPLOAD_SIZE_MB`（默认 20）卡上限，超限 413，且不会真的往 OSS 传 |
| `folder` 参数能越界 | `folder` 是调用方自由文本，`../../etc/ssh` 只被 `strip("/")` 处理，点号原样留下 → 对象 key 前缀可以逃出预期目录 | 只保留 `[A-Za-z0-9_-]`，`.`/`..` 段丢掉，反斜杠当分隔符处理，最多 4 层 |
| 文件名里的路径/怪扩展名 | `ext[:16]` 保留原始大小写和怪字符 | 只取 basename 的后缀，非字母数字剔掉，小写，最长 12 |

另外两条**没改**，只说清现状：

- `GET /api/v1/files/signed-url` 是公开的（匿名可取签名地址），因为前台文章页要给读者渲染封面。它已经挡住越界：`bucket` 不等于 `OSS_BUCKET` 一律 400，非 `oss://` 的 key 也是 400。**含义**：这个 bucket 里不要放任何你不想公开的对象。
- 图片类型没有白名单（只有 `admin` 能上传，且管理员本来就能往文章里塞任意 HTML，卡扩展名意义不大）。**但**这条和 `backend/app/dao/admin.py:54` 写死 `is_admin=True` 是联动的：一旦你为了开放注册把 `ALLOW_REGISTRATION` 设成 true，上传接口就从「只有你能传」变成「任何人都能传任意文件」，那时必须加白名单。


## 后台登录：口令存在哪里、忘了怎么办（2026-10-16）

### 先说三条事实（每条都有代码依据）

| 问题 | 答案 | 依据 |
|---|---|---|
| 后台有几个账号 | 线上只有一个：用户名 `admin`，`is_admin=true` | 服务器上 `admins` 表实测 1 行（2026-10-15 17:2x 只读盘库） |
| 谁能知道口令明文 | **只有设它的人**。库里存的是 bcrypt 单向哈希（`$2b$12$…`，60 个字符），还原不出明文 | `backend/app/utils/security.py:16`（校验）、`:28`（生成） |
| 忘了能不能自己找回 | **线上现在仍然不能。** 没有「忘记密码」，`PATCH /admins/{id}` 只改 `is_admin`；「登录后改密码」（`POST /api/v1/auth/change-password`）2026-10-16 才补进 `dev`，线上跑的是旧版，接口没上线就等于没有 | `backend/app/api/admins.py:36`、`backend/app/api/auth.py:46`、`backend/app/services/auth.py:108` |

### 登进去之前先确认这两点（最常见就是这两条）

- 地址用 **`http://meblog.bugooai.cn/login`**。是 `http` 不是 `https`：443 没人监听（见下面「还没解决的」第 1 条）。直接开 `/admin` 在未登录时会回落成站点首页，那不是坏了。
- 用户名填 `admin`，**填邮箱也一样能过**：接口先按用户名查，查不到再按邮箱查（`backend/app/services/auth.py:79-81`）。
- **别去试「默认口令」**：仓库里（连 6 月那份导入提交 `e276dd4` 一起查过）没有任何生产默认口令。测试夹具里的 `admin123` 只活在 `backend/tests/` 的临时库里，不是你线上那个账号的口令。

### 真进不去：先只读诊断，别先改数据

只读命令（不改任何东西）。超级用户名先取，别照着记忆写：2026-10-16 18:44 UTC 实测这台机的 `common-postgres` 里 `POSTGRES_USER=postgres`，且 `pg_roles` 只有 `postgres` 是超级用户（`admin` / `root` / `test` 都不是），所以 `-U postgres` **现在能用** —— 之前记的「会报 `role "postgres" does not exist`」是换构建之前的事，[HARDENING.md](HARDENING.md) 第 1 节那条也应按这个复测更新。先 `docker inspect` 再动手仍然是对的口径：容器重建过一次，角色就可能整个换名。

```bash
docker inspect common-postgres --format '{{json .Config.Env}}'   # 取 POSTGRES_USER
docker exec -i common-postgres psql -U "<POSTGRES_USER>" -d meblog -c \
  "SELECT username, email, created_at, last_login_at,
          left(password_hash, 4) AS hash_prefix, length(password_hash) AS hash_len
   FROM admins;"
```

怎么读结果：

| `hash_prefix` / `hash_len` | 含义 | 下一步 |
|---|---|---|
| `$2b$` / 60 | 口令正常设过，明文只有本人知道 | 走下面 A 或 B |
| 不是 `$2b$`（例如 `seed-not-for-login`） | **任何口令都登不进去**，报错和「密码错」一模一样，使用者不会知道原委 | 必须重置 |
| `last_login_at` 为空 | 这个账号从来没成功登录过一次 | 佐证上一行 |

判据依据（2026-10-16 在 `backend/.venv` 里用 `app.utils.security` 原函数实测）：正确口令 `True`、错误口令 `False`、`'seed-not-for-login'` / `''` / `'plaintext123456'` 三种非法哈希一律 `False` —— 不抛异常也不报 500，所以坏哈希的表现和输错口令完全一样：401。

实测结果（2026-10-16 18:44 UTC，在服务器上只读跑上面那条 `SELECT`；`admins` 表 1 行，只取前缀和长度，完整哈希不出机器）：

```text
admin|$2b$12$|60|meblog.local|2026-04-28 14:09:48.825785+00|2026-07-19 03:32:20.558021+00
   username  prefix  len  email 域        created_at              last_login_at
```

读出来的结论：**哈希是好的**（`$2b$12$`，60 位），**而且成功登录过**（`last_login_at` = 2026-07-19 03:32 UTC）。所以「那一行从来没设对」这条被排除了，剩下的是口令本身的事。两条附带要看清的地方：

- 邮箱域是 `meblog.local` 这种占位值 —— 这一行更像早期初始化/脚本建的，所以文档里「填邮箱也一样能过」那条在这台上未必有用，用户名还是得填 `admin`。
- `last_login_at` 只有登录成功才会写（`backend/app/services/auth.py:97`），失败不动它。反过来说：他哪天登进去了，这里就会跳到那天，可以拿来当「他到底进去没有」的唯一凭据。

### 重置的两条路（都要布谷点头，都会踢掉他现有的登录态）

**A. 覆盖成新哈希**（推荐，没有暴露窗口）。新口令要从某个渠道传给他一次 —— 所以**必须先有「登录后改密码」能力**（见下面「还没解决的」第 6 条），否则他改不掉，口令长期留在聊天记录里。

同一批里还必须带上 **https**（待批口径见 [CMP-5](/cmp/issues/CMP-5)）。线上现在只开了 80、443 没人监听（「还没解决的」第 1 条），他每次登录输入的口令都在公网明文传；只换一个新口令而不加密，等于把「刚发给他的那个一次性口令」再裸奔一次 —— 换了等于没换。装/签/验/撤照 [HARDENING.md](HARDENING.md) 第 3 节，顺序不能反：**先签再开 80→443 跳转**。

线上部署了带 `backend/reset_admin_password.py` 的版本之后，A 段直接用它，别手拼（同一个口径：口令只从 stdin/环境变量进、打印只出前缀+长度、非本地库要 `--yes`）：

```bash
printf '%s' "$NEW_PW" | docker exec -i -e APP_ENV=production meblog-backend-prod \
  python /app/reset_admin_password.py --stdin --yes
```

在那之前（线上还是旧版），写哈希不要用 shell 拼字符串：bcrypt 哈希里全是 `$`，会被 shell 吃掉。用一次性 python heredoc，走 app 自己的函数，口令只从环境变量或 stdin 进，**不进 argv、不进日志、不打印**（容器内的工作目录已是 `/app`，`app` 包可直接 import）：

```bash
read -rs NEW_PW && export NEW_PW        # 交互式读入，不进 shell 历史、不进 argv
docker exec -i -e NEW_PW meblog-backend-prod python - <<'PY'
import asyncio, os
from sqlalchemy import select
from app.database import SessionLocal
from app.models import Admin
from app.utils.security import get_password_hash


async def main():
    async with SessionLocal() as db:
        row = (await db.execute(select(Admin).where(Admin.username == "admin"))).scalar_one_or_none()
        if row is None:
            print("没有 username=admin 这一行，停手，先做只读诊断")
            return
        row.password_hash = get_password_hash(os.environ["NEW_PW"])
        await db.commit()
        print("已更新 1 行；口令未打印")   # 别在这里打印口令或哈希


asyncio.run(main())
PY
unset NEW_PW
```

改前先留一份原值，撤销就是把这一行写回去（哈希不可逆，写回原哈希等于恢复旧口令）：

```bash
docker exec -i common-postgres psql -U "<POSTGRES_USER>" -d meblog -c \
  "COPY (SELECT id, username, email, password_hash, is_admin FROM admins) TO STDOUT" \
  > /root/backups/admins-row-$(date -u +%Y%m%dT%H%M%SZ).tsv
```

**B. 清空 `admins` 表，用登录页的「初始化站点」面板自建账号**（`frontend/app/login/LoginForm.tsx:51-58`：建号 + 自动登录在一次提交里做完）。好处：口令全程不过第三者的手。代价要看清 —— **空库期间任何人都能来抢这个管理员**：`backend/app/services/auth.py:49` 空库第一个账号一定是管理员，`:66-69` 这时 `allow_registration` 也强制为 true。所以这条只适合「他人当场建完」，绝不能空着过夜。另外文章的 `created_by` 是 `String(36)`、**没有外键**，删号不报错，但作者归属会指向一个不存在的 id。

### 验法

```bash
curl -s -o /dev/null -w '%{http_code} %{time_total}s\n' -X POST http://meblog.bugooai.cn/api/v1/auth/login \
  -H 'Content-Type: application/x-www-form-urlencoded' -d 'username=admin' -d 'password=<新口令>'
# 期望 200；401 = 哈希没写进去或口令不对；浏览器随后 /login 能进 /admin 才算通
```


### 想把口令设成 `admin`：先看清这道闸（2026-10-18 本地实证）

布谷 2026-10-17 15:47 提过「我期望是密码也是 admin」。这条路现在**走不通，而且是故意堵的**：

- `backend/reset_admin_password.py` 有 `MIN_PASSWORD_LENGTH = 8`。本地实证（一次性 sqlite 库，没碰任何现有库）：`printf 'admin\n' | .venv/bin/python reset_admin_password.py --stdin` → `新口令太短（来源 stdin）：至少 8 位，和建号/改密接口同口径。`，**exit=2，一个字都没写库**；同一支脚本喂 13 位口令 → `已更新 1 行`，exit=0，事后 `verify_password` 新口令 `True`、`'admin'` `False`。
- 同一个 8 位下限一共 5 处：`reset_admin_password.MIN_PASSWORD_LENGTH`、`AdminCreate.password`（`backend/app/schemas/admin.py:10`）、注册载荷（`:58`）、`PasswordChangeRequest.new_password`（`:74`）、前端 `MIN_LENGTH`（`frontend/app/admin/settings/password/page.tsx:52`）。
- **技术上不是不可能**：`get_password_hash("admin")` 照样生成合法 bcrypt 哈希（本地实测 `verify_password("admin", 该哈希) == True`），绕过脚本直接写库就能登。所以这是一道**策略闸**，要设成 `admin` 必须显式决定「把 5 处下限一起改掉」，不能靠手滑绕过。
- 后果写清楚：站点是公网 HTTP（443 不通）、后台账号名本来就叫 `admin`，口令再是 `admin` = 扫描器第一次尝试就能进。拿到的不只是改文章权限，还有 `POST /api/v1/files/upload`（往你的 OSS bucket 写对象）。

**推荐顺序**：先把带 `change-password` 的版本发上线（`dev` ff 到 `main` + 运维重建前后端镜像），布谷自己登进去把口令改成任何他想要的值 —— 口令全程不进工单、不进附件、不进聊天记录，也不需要第二个人知道明文。真要 `admin` 这个值，得同批装上 HTTPS（[CMP-5](/cmp/issues/CMP-5)）并显式批准降低下限。

## 还没解决的（按影响排序）

1. **HTTPS 没上**：`https://meblog.bugooai.cn` 无响应。登录态是 cookie + JWT，明文 HTTP 上跑等于裸奔；而且微信/微博对 http 链接的抓取也不如 https 稳定。域名已经解析到机器上，套一层 certbot 就能解决 —— 目标配置见 `deploy/nginx/meblog.bugooai.cn.conf`，装/签/验/撤的完整步骤见 [HARDENING.md](HARDENING.md) 第 3 节（**先签再开 80→443 跳转**，顺序反了签不下来）。
2. **备案**：`.cn` 域名走国内阿里云，80 端口能通说明要么备过、要么用了别的方式，上线前自己确认一下，别到时候被切断。
3. **泄露口令**：那台机既是博客又跑着历史上写进源码的测试库（`...:6001/meblog_test`），端口现在还开不开得你确认；口令必须轮换。2026-10-15 17:26 实测 `116.62.176.216:8200` **仍是公网可达的 PostgreSQL**（协议握手回包 `b'N'`，且拒绝 SSL = 口令明文过网），`ufw` 还是 `inactive`，公网可达性完全取决于阿里云安全组。改前基线、外部消费者怎么先确认、两种收口方案和撤销方法都在 [HARDENING.md](HARDENING.md) 第 1、4 节。
4. ~~**`is_admin` 写死**~~：已修（`fcebeb0`）。`AdminDao.create_admin` 的 `is_admin` 现在是必填参数，公开注册只在空库时给管理员，之后注册的一律是一般账号；加管理员只能由管理员走 `POST /api/v1/admins`。`ALLOW_REGISTRATION` 仍建议保持 false —— 不是怕提权，是一般账号目前除了登录没有任何专属能力。
5. **两套 sitemap**：前端 `app/sitemap.ts` 和后端 `app/api/seo.py` 都在生成 sitemap/feed。域名上生效的是前端那份。留着两条路以后必然不一致，等你定留哪个。
6. **后台没有改密码 / 找回口令的路径**（2026-10-16 记；同日代码已补进 `dev`，**线上待部署**）：① `POST /api/v1/auth/change-password` —— 先验旧口令再写新哈希，新口令沿用建号口径 `min_length=8`；后台设置页多一张「登录口令」卡片（`/admin/settings/password`）。② `backend/reset_admin_password.py` —— 运维侧一次性重置，口径照 `backend/create_tables.py`：口令只从 stdin/环境变量读、打印只出前缀+长度、非本地库要 `--yes`；**找不到账号就停手**，不代替登录页的初始化面板建号。两件都有测试（`backend/tests/test_auth.py::TestAuthChangePassword`、`backend/tests/test_reset_admin_password.py`）。这两件做完，A 路才算安全，B 路那个「空库谁都能抢管理员」的暴露窗口也就不需要了。
   - **一条取舍写在这里**：改完口令，**已签发的 JWT 仍然有效到自然过期**（`ACCESS_TOKEN_EXPIRE_MINUTES`，默认 7 天）。token 里只有 `sub`，没有口令版本声明，`get_current_user` 分不出签发先后 —— 想让「改口令即踢掉所有会话」，得给 token 加 `pwd_version` 并在解码时比对。这条没做，界面上先把「其它设备不会立刻掉线」写明（`frontend/app/admin/settings/password/page.tsx`）。
   - **仍然没有「忘记密码」**：知道旧口令就自己在后台改；不知道就只能按上一节 A 重置一次，重置前必须先留档。
7. ~~**生产环境公开 `openapi.json`**~~：已修（2026-10-18，`dev`，布谷在卡片 `0dbedb01` 里选了「现在就关」）。`GET /api/v1/openapi.json` 曾经不用登录就返回 **200 / 42 KB** 的全量路由、参数和响应结构（`/api/v1/admins`、`/api/v1/files/upload` 都在里面）。现在由 `EXPOSE_OPENAPI` 控制：`configs/base.py` 默认 `False`，只有 `configs/local.py` 默认 `True`；`backend/app/main.py` 的 `build_openapi_url()` 按它决定传地址还是 `None`（传 `None` 时 FastAPI 连带不挂 `/docs`、`/redoc`）。4 条测试锁住默认口径、开关接线和实际可达性：`backend/tests/test_openapi_exposure.py`。
   - **更正我上一版的一句归因**：线上 `/docs` 返回 404 并不是「FastAPI 把文档关了」，而是 nginx 只把 `/api/*` 转给后端，`/docs` 落到前端 Next 上。所以「关了门面、留着图纸」这个说法里，门面本来就没开过；真暴露的是 `/api/v1/openapi.json` —— 它恰好在 `/api/*` 这条转发路径上。
   - 生效条件：这是代码不是环境变量，**必须重建后端镜像**才生效，见上面「本次发版（2026-10-18）」。
