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

首页没有任何 `og:` / JSON-LD，说明部署的是 `main`（`b8e035f`）那一版；`WebSite`/`BlogPosting`/`BreadcrumbList`、og:image 兜底这些在 `dev` 上（PR #3），你选的是「dev 先不合 main」，所以线上暂时不会有。要线上生效就得发一次版。

## 一个会咬人的坑：revalidate 走域名不通

`/api/internal/revalidate` 是**前端**的 Next 路由，但 nginx 把域名的 `/api/*` 整段转给了 FastAPI。实测：

```
POST http://meblog.bugooai.cn/api/internal/revalidate
→ 404  {"detail":"Not Found"}     # 这个 JSON 形状是 FastAPI 的默认 404，不是 Next 的
```

所以后端的通知地址必须写**容器间地址**，绕开 nginx：

```
FRONTEND_REVALIDATE_URL=http://memblog-frontend-prod:3000/api/internal/revalidate
FRONTEND_REVALIDATE_TOKEN=<等于前端 REVALIDATE_SECRET>
```

容器名来自 `docker-compose-*-production.yml`（`memblog-backend-prod` / `memblog-frontend-prod`，都在 external 网络 `common-network` 上）。前端生产映射是 `9001:3000`，后端是 `9000:8000`，容器内部仍听 3000 / 8000。

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


## 还没解决的（按影响排序）

1. **HTTPS 没上**：`https://meblog.bugooai.cn` 无响应。登录态是 cookie + JWT，明文 HTTP 上跑等于裸奔；而且微信/微博对 http 链接的抓取也不如 https 稳定。域名已经解析到机器上，套一层 certbot 就能解决。
2. **备案**：`.cn` 域名走国内阿里云，80 端口能通说明要么备过、要么用了别的方式，上线前自己确认一下，别到时候被切断。
3. **泄露口令**：那台机既是博客又跑着历史上写进源码的测试库（`...:6001/meblog_test`），端口现在还开不开得你确认；口令必须轮换。
4. **`is_admin` 写死**：`backend/app/dao/admin.py:54`。现在靠 `ALLOW_REGISTRATION=false` 挡着，**千万别为了开放注册把它设成 true**，否则任何人都能注册成管理员。
5. **两套 sitemap**：前端 `app/sitemap.ts` 和后端 `app/api/seo.py` 都在生成 sitemap/feed。域名上生效的是前端那份。留着两条路以后必然不一致，等你定留哪个。
