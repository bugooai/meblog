# 设计核查：一个人发文章，这套设计够不够

目标（用户原话）：「我的目标是只有一个可发文章，看下设计是否满足」。

结论：**满足**。作者身份、发文链路、署名、SEO/RSS 的作者实体全部走的是「单例作者」这一条路，
不需要多作者那套东西。核查方式是端到端真跑，不是读代码猜。

## 实测链路（本地，空库起步）

| 步骤 | 结果 |
|---|---|
| 空库注册第一个账号 | 201，`is_admin=true` |
| 登录 / `/auth/me` | 200 / 200 |
| 再注册第二个账号 | 403 Registration is closed（默认关闭注册） |
| 写作者资料 `PUT /api/v1/about` | 200 |
| 发文（不挂项目、不打标签） | 201，响应里 `author = {id, username}` 已填 |
| 文章页 | 200，`og:title` / `twitter:card=summary_large_image`，HTML 里无 `oss://` 残留 |
| JSON-LD | `BlogPosting.author` + `BreadcrumbList` 有效 |
| RSS | 1 个 `<item>`，`<author>` 是作者名 |
| 首页 | 含该文章标题 |
| 关于页 | 作者名服务端直出（本次修复项，见下） |

## 为什么它是「单作者」设计

- `AuthorProfile` 是**单行表**（`backend/app/models/settings.py`），不是「用户资料」：一个站点只有一份作者名/头像/简介/技术栈/经历/社交链接。
- 文章署名不看你用哪个账号发的：`backend/app/services/post.py` 的 `_build_author_info()` 取的是那唯一一行 `AuthorProfile`，`PostResponse.author` 由它生成。所以将来真出现第二个管理员账号，前台署名仍然是同一个人 —— 这正是单作者博客要的行为。
- `Post` 上的 `user_id` / `created_by` 只记录「谁建的」，不参与展示。
- 点赞与评论走匿名 IP，不认账号；前端没有注册页。所以「一般账号」现在除了登录没有任何专属能力。
  **这是有意的**，不是漏功能：真要让注册有意义，得先给它配能力（评论身份、收藏、订阅）。

## 本次修掉的真实缺口

`frontend/app/about/page.tsx` 以前是纯客户端组件，而且写死了一套**不属于站长的履历**：

- 服务端 HTML 里作者名/简介/经历一个都没有，`og:title` 是站点默认值，`canonical` 指向站点根 —— 而文章页 JSON-LD 的 `author.url` 恰好指向这一页，等于把作者实体指到一张白页。
- JSX 里硬编码：「从高并发后端架构到 AI 基础设施 的深度实践者」、「AI 应用平台技术专家 / FULL STACK AI ENGINEER / 架构 · 工程 · 产品 · 组织」、`9+ / 10+ / 90%+ / 99.9%` 四个假指标、没填简介时的「10+ 年工程经验…」兜底，以及 `DEFAULT_TECH_STACK` / `DEFAULT_CAREER_TIMELINE` 两套模板简历。

对「提升个人影响力」这个目标是反效果的：内容会把别人的资历算到你头上，爬虫还什么都读不到。

现在：页面服务端渲染；这一节没配就不渲染；`Person` JSON-LD 带稳定 `@id`
（`{SITE_URL}/about#author`），文章页 `BlogPosting.author` 引用同一个 `@id`，两处合成一个作者实体。

## 仍存在的摩擦（没改代码，故意的）

1. **第一个账号只能从 API 建**（`docs/RUN_LOCALLY.md` 第 2 节）。默认 `ALLOW_REGISTRATION=false`，
   开一次注册建完号就该关掉。做成前端「空库初始化」入口更安全吗？不一定 —— 一旦库里有任何账号，
   接口就 403，所以加入口的风险可控，但那是一块新的公开攻击面，留给用户决定。
2. **`ALLOW_REGISTRATION` 应保持 false**。上一轮拆掉了「注册即管理员」那颗雷，
   但开注册除了让人刷账号没有别的好处，直到一般账号配上专属能力为止。
3. **图片地址仍是签名 URL（默认 3600 秒过期）**。bucket 私有，RSS/分享卡片里的图迟早失效。
   要永久地址就单开一个公共读 bucket（或 CDN+自定义域名）填 `OSS_PUBLIC_BASE_URL`，代码已支持。
