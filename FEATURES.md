# Meblog 功能清单与实施指南

> **文档版本**: v1.0.0  
> **创建时间**: 2026-04-28  
> **最后更新**: 2026-04-28

---

## 📋 目录

1. [功能总览](#1-功能总览)
2. [已有功能详解](#2-已有功能详解)
3. [待开发功能清单](#3-待开发功能清单)
4. [功能优先级矩阵](#4-功能优先级矩阵)
5. [实施指南](#5-实施指南)

---

## 1. 功能总览

### 1.1 功能模块划分

```
Meblog 功能体系
├─ 内容管理模块
│  ├─ 文章管理
│  ├─ 项目管理
│  ├─ 标签管理
│  ├─ 草稿管理
│  └─ 定时发布
│
├─ 用户交互模块
│  ├─ 用户认证
│  ├─ 评论系统
│  ├─ 点赞功能
│  ├─ 收藏功能
│  └─ 分享功能
│
├─ 内容展示模块
│  ├─ 首页展示
│  ├─ 文章详情
│  ├─ 项目列表
│  ├─ 标签筛选
│  ├─ 关于页面
│  └─ 归档页面
│
├─ 管理后台模块
│  ├─ 文章管理后台
│  ├─ 项目管理后台
│  ├─ 标签管理后台
│  ├─ 设置管理后台
│  └─ 统计仪表盘
│
├─ SEO 优化模块
│  ├─ 站点地图
│  ├─ robots.txt
│  ├─ RSS Feed
│  ├─ Open Graph
│  └─ 结构化数据
│
├─ 订阅通知模块
│  ├─ 邮件订阅
│  ├─ 通知推送
│  └─ 评论提醒
│
├─ 数据分析模块
│  ├─ 访问统计
│  ├─ 用户分析
│  ├─ 内容分析
│  └─ 转化漏斗
│
└─ 系统设置模块
   ├─ 站点配置
   ├─ 作者配置
   ├─ 主题配置
   └─ OSS 配置
```

---

## 2. 已有功能详解

### 2.1 内容管理

#### ✅ 文章管理

**已实现功能**：
- 创建文章（标题、Slug、正文、项目、标签）
- 编辑文章（所有字段可修改）
- 软删除文章（标记 `is_deleted`）
- 草稿/发布状态切换
- 文章隐藏功能（对普通用户隐藏）
- Markdown 富文本编辑
- 代码高亮（支持 50+ 编程语言）
- 数学公式渲染（KaTeX LaTeX）
- 封面图片上传（阿里云 OSS）
- 自动摘要生成
- 手动摘要填写
- URL 友好 Slug 自动生成
- 阅读量统计
- 点赞统计

**数据模型**：
```python
Post {
  id: str (UUID)           # 主键
  title: str               # 标题（max 200）
  slug: str                # URL 别名（唯一）
  cover: str | null        # 封面图 URL
  content: str              # Markdown 正文
  summary: str | null      # 摘要
  view_count: int          # 阅读量
  like_count: int         # 点赞数
  status: str              # draft | published
  is_hidden: bool          # 是否隐藏
  is_deleted: bool         # 是否删除
  user_id: str             # 作者 ID
  project_id: str | null   # 项目 ID
  tags: list[Tag]          # 标签列表
  project: Project         # 所属项目
  created_at: datetime
  updated_at: datetime
}
```

**API 端点**：
```
GET    /api/v1/posts                 # 获取文章列表（分页、筛选）
GET    /api/v1/posts/{id_or_slug}    # 获取文章详情
POST   /api/v1/posts                 # 创建文章（需认证）
PUT    /api/v1/posts/{post_id}       # 更新文章（需认证）
DELETE /api/v1/posts/{post_id}       # 删除文章（需认证）
GET    /api/v1/posts/{slug}/like     # 获取点赞状态
POST   /api/v1/posts/{slug}/like     # 切换点赞状态
```

#### ✅ 项目管理

**已实现功能**：
- 创建项目（名称、Slug）
- 编辑项目
- 删除项目（含文章约束检查）
- 查看项目列表
- 查看项目文章数量
- URL 友好 Slug 自动生成

**数据模型**：
```python
Project {
  id: str (UUID)
  name: str              # 项目名（max 50，唯一）
  slug: str              # URL 别名（唯一）
  created_at: datetime
}
```

**API 端点**：
```
GET    /api/v1/projects             # 获取项目列表
GET    /api/v1/projects/{id_or_slug} # 获取项目详情
POST   /api/v1/projects             # 创建项目（需认证）
PUT    /api/v1/projects/{project_id} # 更新项目（需认证）
DELETE /api/v1/projects/{project_id} # 删除项目（需认证）
```

#### ✅ 标签管理

**已实现功能**：
- 创建标签（名称、Slug）
- 编辑标签
- 删除标签（含文章约束检查）
- 查看标签列表
- 查看标签文章数量
- URL 友好 Slug 自动生成

**数据模型**：
```python
Tag {
  id: str (UUID)
  name: str              # 标签名（max 50，唯一）
  slug: str              # URL 别名（唯一）
  created_at: datetime
}

post_tags {
  post_id: str (FK)
  tag_id: str (FK)
}
```

**API 端点**：
```
GET    /api/v1/tags                 # 获取标签列表
GET    /api/v1/tags/{id_or_slug}    # 获取标签详情
POST   /api/v1/tags                 # 创建标签（需认证）
PUT    /api/v1/tags/{tag_id}         # 更新标签（需认证）
DELETE /api/v1/tags/{tag_id}         # 删除标签（需认证）
```

### 2.2 用户认证

#### ✅ 用户登录/注册

**已实现功能**：
- 用户名/邮箱登录
- JWT Token 认证
- Token 有效期 3 天
- 密码加密存储（bcrypt）
- 管理员角色区分
- 会话管理

**数据模型**：
```python
Admin {
  id: str (UUID)
  username: str            # 用户名（3-20 字符）
  email: str               # 邮箱（唯一）
  password_hash: str       # 密码哈希
  is_super_admin: bool    # 是否超级管理员
  created_at: datetime
  updated_at: datetime
}
```

**API 端点**：
```
POST   /api/v1/auth/login            # 登录
POST   /api/v1/auth/register        # 注册（可选关闭）
GET    /api/v1/auth/me              # 获取当前用户
PUT    /api/v1/auth/password        # 修改密码
```

### 2.3 评论系统

#### ✅ 基础评论功能

**已实现功能**：
- 评论列表展示
- Markdown 评论支持
- 评论时间倒序
- 评论分页
- 评论回复（parent_id）
- 敏感词过滤（基础）

**数据模型**：
```python
Comment {
  id: str (UUID)
  content: str             # 评论内容（Markdown）
  post_id: str (FK)       # 关联文章
  user_id: str (FK)       # 评论者
  parent_id: str | null   # 父评论（回复）
  is_approved: bool        # 是否审核通过
  created_at: datetime
}
```

**API 端点**：
```
GET    /api/v1/comments?post_id={id}     # 获取评论列表
POST   /api/v1/comments                    # 创建评论（需认证）
DELETE /api/v1/comments/{comment_id}      # 删除评论（需认证）
```

### 2.4 站点配置

#### ✅ 站点设置

**已实现功能**：
- 公众号二维码 URL
- 公众号引导文案
- 文章页公众号展示开关
- 侧边栏公众号展示开关
- Footer GitHub 链接
- ICP 备案号

**数据模型**：
```python
SiteSettings {
  id: str (UUID)
  wechat_qr_url: str | null        # 公众号二维码
  wechat_guide_text: str            # 引导文案
  wechat_show_on_article: bool      # 文章页展示
  wechat_show_in_sidebar: bool     # 侧边栏展示
  footer_github_url: str | null    # GitHub 链接
  beian_icp: str | null            # ICP 备案号
}
```

**API 端点**：
```
GET    /api/v1/settings/site         # 获取站点设置
PUT    /api/v1/settings/site         # 更新站点设置（需认证）
```

#### ✅ 作者资料

**已实现功能**：
- 用户名/头像
- 个人简介（Bio）
- 技术栈展示
- 职业时间线
- 社交媒体链接（GitHub、知乎、Twitter、微信）

**数据模型**：
```python
AuthorProfile {
  id: str (UUID)
  username: str
  avatar_url: str | null
  bio: str | null
  tech_stack_json: str | null      # 技术栈 JSON
  career_timeline_json: str | null # 职业时间线 JSON
  github_url: str | null
  zhihu_url: str | null
  twitter_url: str | null
  wechat_id: str | null
}
```

**API 端点**：
```
GET    /api/v1/about                 # 获取作者资料
PUT    /api/v1/about                 # 更新作者资料（需认证）
```

### 2.5 统计分析

#### ✅ 访问统计

**已实现功能**：
- 访问日志记录（浏览器指纹、IP、UA）
- 独立访客识别
- 访问趋势分析
- 热门文章排行
- 管理员仪表盘
- 公开统计摘要

**数据模型**：
```python
Visitor {
  id: str (UUID)
  fingerprint: str             # 浏览器指纹
  ip_address: str | null
  user_agent: str | null
  first_visit: datetime
  last_visit: datetime
  visit_count: int
}

PostViewEvent {
  id: str (UUID)
  post_id: str (FK)
  visitor_id: str (FK)
  viewed_at: datetime
  session_id: str
}

PostLike {
  id: str (UUID)
  post_id: str (FK)
  visitor_id: str (FK)
  liked_at: datetime
}
```

**API 端点**：
```
POST   /api/v1/stats/log/{post_id}          # 记录访问
GET    /api/v1/stats/post/{post_id}/unique-visitors  # 独立访客
GET    /api/v1/stats/trends                  # 访问趋势
GET    /api/v1/stats/popular-posts          # 热门文章
GET    /api/v1/stats/summary                 # 统计摘要
GET    /api/v1/stats/public-summary         # 公开摘要
GET    /api/v1/stats/admin-dashboard        # 管理仪表盘
```

### 2.6 SEO 优化

#### ✅ 已实现 SEO 功能

**技术 SEO**：
- ✅ 自动生成 sitemap.xml（所有页面）
- ✅ robots.txt 配置
- ✅ Canonical URL
- ✅ HTML 语义化标签

**Open Graph**：
- ✅ og:title
- ✅ og:description
- ✅ og:image
- ✅ og:url
- ✅ og:type

**结构化数据**：
- ✅ Article 结构化数据
- ✅ BreadcrumbList 结构化数据
- ✅ Organization 结构化数据

**社交分享**：
- ✅ Twitter Card 支持
- ✅ 微信分享卡片
- ✅ 分享图片生成

**内容 SEO**：
- ✅ 自动生成 Meta 描述
- ✅ 关键词提取（基于标题）
- ✅ 内链结构优化
- ✅ URL 友好化

### 2.7 前台展示

#### ✅ 页面清单

| 页面 | URL | 说明 |
|------|-----|------|
| 首页 | `/` | 最新文章列表 + 分页 |
| 文章详情 | `/post/{slug}` | Markdown 渲染 + 目录 |
| 项目列表 | `/projects` | 所有项目展示 |
| 项目详情 | `/project/{slug}` | 项目文章列表 |
| 标签列表 | `/tags` | 所有标签 |
| 标签详情 | `/tag/{slug}` | 标签文章列表 |
| 关于页面 | `/about` | 个人品牌展示 |
| 归档页面 | `/archive` | 按时间归档 |
| RSS Feed | `/feed.xml` | RSS 2.0 |
| 站点地图 | `/sitemap.xml` | XML sitemap |

#### ✅ 组件库

| 组件 | 说明 |
|------|------|
| Navbar | 响应式导航栏 |
| Footer | 可配置页脚 |
| PostCard | 文章卡片 |
| CoverImage | 封面图组件 |
| LikeButton | 点赞按钮 |
| Comments | 评论列表 |
| MarkdownRenderer | Markdown 渲染 |
| AuthorCard | 作者信息卡 |
| ThemeToggle | 主题切换 |
| Pagination | 分页组件 |
| TableOfContents | 文章目录 |
| WechatQR | 公众号二维码 |
| TechStack | 技术栈展示 |

### 2.8 管理后台

#### ✅ 后台功能

| 模块 | 功能 |
|------|------|
| **文章管理** | 列表、新建、编辑、删除、状态切换、隐藏控制 |
| **项目管理** | 列表、新建、编辑、删除 |
| **标签管理** | 列表、新建、编辑、删除 |
| **网站设置** | 公众号配置、Footer 配置 |
| **作者设置** | 资料编辑、社交链接 |
| **统计仪表盘** | 访问统计、热门文章 |

---

## 3. 待开发功能清单

### 3.1 内容管理增强

#### 🔲 高级编辑器

**需求描述**：
增强 Markdown 编辑器，提升写作体验。

**功能清单**：
- [ ] Markdown 快捷工具栏
- [ ] 实时预览面板（左右分栏）
- [ ] 图片粘贴自动上传
- [ ] 代码块语法高亮
- [ ] 表格可视化编辑
- [ ] Mermaid 图表支持
- [ ] 公式可视化编辑
- [ ] 草稿自动保存（每 30 秒）
- [ ] 版本历史（最近 10 个版本）
- [ ] 差异对比功能
- [ ] 字数统计
- [ ] 阅读时间估算

**技术方案**：
```typescript
// 推荐使用 @uiw/react-md-editor 或自定义
interface EditorConfig {
  preview: 'live' | 'edit' | 'preview' | 'tab';
  toolbar: [
    'bold', 'italic', 'strikethrough', '|',
    'h1', 'h2', 'h3', '|',
    'list', 'ordered-list', 'check', '|',
    'code', 'code-block', '|',
    'link', 'image', 'table', '|',
    'mermaid', 'katex', '|',
    'undo', 'redo', '|',
    'fullscreen'
  ];
  autoSave: {
    enabled: true;
    interval: 30000; // ms
  };
  versionHistory: {
    enabled: true;
    maxVersions: 10;
  };
}
```

**预估工时**：2-3 周

**优先级**：⭐⭐⭐⭐

#### 🔲 内容计划与定时发布

**需求描述**：
支持草稿队列管理和定时发布功能。

**功能清单**：
- [ ] 草稿状态管理（idea → outline → writing → review → scheduled）
- [ ] 定时发布时间设置
- [ ] 发布前审核预览
- [ ] 发布提醒（邮件通知博主）
- [ ] 定时任务自动发布（后端 cron job）
- [ ] 发布后自动通知订阅者

**数据模型**：
```python
class PostSchedule(Base):
  __tablename__ = "post_schedules"
  
  post_id: Mapped[str] = mapped_column(String(36), unique=True)
  scheduled_at: Mapped[datetime]  # 计划发布时间
  notified_at: Mapped[datetime | None]  # 提醒时间
  status: Mapped[str] = mapped_column(String(20))  # pending/sent/cancelled
  
class DraftVersion(Base):
  __tablename__ = "draft_versions"
  
  id: Mapped[str] = mapped_column(String(36), primary_key=True)
  post_id: Mapped[str] = mapped_column(String(36))
  version: Mapped[int]
  content: Mapped[str]
  created_at: Mapped[datetime]
```

**预估工时**：1-2 周

**优先级**：⭐⭐⭐

#### 🔲 相关文章推荐

**需求描述**：
在文章详情页底部展示相关文章推荐。

**功能清单**：
- [ ] 基于标签的推荐
- [ ] 基于项目的推荐
- [ ] 基于关键词相似度
- [ ] 阅读量权重排序
- [ ] 推荐数量可配置（默认 5 篇）
- [ ] 推荐算法 A/B 测试

**技术方案**：
```typescript
interface RecommendationConfig {
  // 推荐来源权重
  weights: {
    tagMatch: 0.4;      // 标签匹配
    projectMatch: 0.3;  // 项目匹配
    keywordSimilarity: 0.3;  // 关键词相似度
  };
  
  // 排序参数
  sorting: {
    recencyWeight: 0.2;    // 新鲜度权重
    qualityScore: 0.3;     // 质量分数
  };
  
  // 展示配置
  display: {
    count: 5;
    showCover: true;
    showSummary: true;
  };
}
```

**预估工时**：1 周

**优先级**：⭐⭐⭐⭐

### 3.2 社区互动增强

#### 🔲 评论系统升级

**需求描述**：
增强评论系统，提升社区活跃度。

**功能清单**：
- [ ] 评论审核（垃圾过滤、敏感词）
- [ ] 评论置顶（作者可置顶优质评论）
- [ ] 评论点赞（好评论排序靠前）
- [ ] @提及功能（通知被提及用户）
- [ ] 评论通知（邮件/站内）
- [ ] 评论表情反应（👍❤️🚀）
- [ ] 评论举报功能
- [ ] 评论编辑（5 分钟内）
- [ ] 评论删除（作者可删除）
- [ ] Markdown 代码高亮支持

**技术实现**：
```python
class Comment(Base):
  id: Mapped[str]
  content: Mapped[str]
  post_id: Mapped[str]
  user_id: Mapped[str]
  parent_id: Mapped[str | None]
  is_approved: Mapped[bool] = False
  is_pinned: Mapped[bool] = False
  like_count: Mapped[int] = 0
  reported_count: Mapped[int] = 0
  edited_at: Mapped[datetime | None]
  created_at: Mapped[datetime]

class CommentReaction(Base):
  id: Mapped[str]
  comment_id: Mapped[str]
  visitor_id: Mapped[str]
  reaction_type: Mapped[str]  # thumbs_up / heart / rocket
  created_at: Mapped[datetime]
```

**审核规则**：
```python
class CommentModeration:
  # 自动审核
  spam_threshold: float = 0.8
  sensitive_words: list[str] = [...]
  
  # 限流
  max_per_hour: int = 10
  min_interval_seconds: int = 30
  
  # 人工审核
  require_approval: bool = False
  auto_approve_trusted: bool = True
```

**预估工时**：2-3 周

**优先级**：⭐⭐⭐⭐

#### 🔲 邮件订阅系统

**需求描述**：
建立邮件订阅体系，实现内容分发和用户留存。

**功能清单**：
- [ ] 订阅弹窗（首次访问）
- [ ] 订阅表单（底部/侧边栏）
- [ ] 订阅确认（双重 opt-in）
- [ ] 退订链接（每封邮件必须）
- [ ] 订阅偏好设置
- [ ] 发送频率控制（即时/每日/每周）
- [ ] 全站订阅
- [ ] 标签订阅
- [ ] 项目订阅
- [ ] 新文章通知
- [ ] 文章更新通知
- [ ] 评论回复通知
- [ ] 邮件模板设计
- [ ] 邮件追踪（打开率、点击率）
- [ ] 发送失败处理（退订、Bounce）

**数据模型**：
```python
class Subscriber(Base):
  id: Mapped[str]
  email: Mapped[str] = unique=True
  subscribed_at: Mapped[datetime]
  status: Mapped[str] = 'active'  # active/unsubscribed/bounced
  
  # 订阅偏好
  subscription_type: Mapped[str] = 'all'  # all/tag/project
  tags: Mapped[list[str]] = []  # 标签 ID 列表
  projects: Mapped[list[str]] = []  # 项目 ID 列表
  frequency: Mapped[str] = 'immediate'  # immediate/daily/weekly
  
  # 追踪
  confirm_token: Mapped[str]
  unsubscribe_token: Mapped[str]
  last_sent_at: Mapped[datetime | None]
  open_count: Mapped[int] = 0
  click_count: Mapped[int] = 0

class NewsletterEmail(Base):
  id: Mapped[str]
  post_id: Mapped[str]
  subject: Mapped[str]
  sent_at: Mapped[datetime]
  recipients_count: Mapped[int]
  opened_count: Mapped[int]
  clicked_count: Mapped[int]
```

**技术架构**：
```
订阅流程：
1. 用户输入邮箱 → 发送确认邮件
2. 点击确认链接 → 激活订阅
3. 发布新文章 → 创建邮件任务
4. 邮件服务发送 → 追踪打开/点击
5. 用户退订 → 标记状态

技术栈：
├─ 邮件服务：SendGrid / Mailgun / AWS SES
├─ 订阅管理：PostgreSQL
├─ 发送队列：Redis Queue / Celery
├─ 模板引擎：MJML / React Email
└─ 追踪像素：自定义 / Mailchimp
```

**预估工时**：3-4 周

**优先级**：⭐⭐⭐⭐⭐

#### 🔲 收藏与分享

**需求描述**：
支持用户收藏文章和社交分享。

**功能清单**：
- [ ] 收藏文章（需登录）
- [ ] 收藏列表页（`/favorites`）
- [ ] 收藏夹管理（分类、排序）
- [ ] 收藏时通知（可选）
- [ ] 微信分享（生成海报）
- [ ] 微博分享
- [ ] Twitter 分享
- [ ] 复制链接（带追踪参数）
- [ ] 二维码生成

**数据模型**：
```python
class Collection(Base):
  id: Mapped[str]
  user_id: Mapped[str]
  post_id: Mapped[str]
  created_at: Mapped[datetime]
  
class ShareTracking(Base):
  id: Mapped[str]
  post_id: Mapped[str]
  platform: Mapped[str]  # wechat/weibo/twitter/copy
  visitor_id: Mapped[str]
  shared_at: Mapped[datetime]
```

**预估工时**：1 周

**优先级**：⭐⭐⭐

### 3.3 SEO 与流量增长

#### 🔲 高级 SEO 优化

**需求描述**：
全面的 SEO 优化，提升搜索排名。

**功能清单**：
- [ ] 关键词研究工具集成
- [ ] 页面 SEO 评分
- [ ] 自动生成 Meta 关键词
- [ ] Open Graph 优化
- [ ] Twitter Card 优化
- [ ] 结构化数据（Article、BreadcrumbList）
- [ ] 内部链接优化建议
- [ ] 404 页面优化
- [ ] 重定向管理
- [ ] AMP 页面支持（文章页）
- [ ] 多语言 SEO（英文版）
- [ ] 本地 SEO（百度、搜狗）
- [ ] SEO 效果追踪

**技术实现**：
```typescript
interface SEOToolConfig {
  // 自动关键词
  autoKeywords: {
    enabled: true;
    sources: ['title', 'h2', 'firstParagraph'];
    maxKeywords: 5;
  };
  
  // 结构化数据
  structuredData: {
    article: true;
    breadcrumb: true;
    author: true;
    organization: true;
  };
  
  // AMP
  amp: {
    enabled: true;
    pages: ['post'];
  };
  
  // 多语言
  i18n: {
    enabled: false;
    languages: ['en'];
    defaultLanguage: 'zh-CN';
  };
}
```

**预估工时**：2-3 周

**优先级**：⭐⭐⭐⭐⭐

#### 🔲 站点地图自动化

**需求描述**：
增强站点地图，支持动态更新和搜索平台通知。

**功能清单**：
- [ ] 页面优先级自动设置
- [ ] 更新频率自动设置
- [ ] 发布时自动更新 sitemap
- [ ] 主动推送给 Google
- [ ] 主动推送给 Bing
- [ ] 百度站长平台集成
- [ ] sitemap 分析报告

**技术实现**：
```python
class SitemapConfig(BaseSettings):
  # 页面优先级
  priority: dict = {
    'home': 1.0,
    'about': 0.9,
    'posts': 0.8,
    'post_detail': 0.7,
    'tags': 0.6,
    'projects': 0.6,
  }
  
  # 更新频率
  changefreq: dict = {
    'home': 'daily',
    'posts': 'weekly',
    'post_detail': 'monthly',
    'about': 'monthly',
  }
  
  # 自动更新
  auto_update: bool = True
  ping_google: bool = True
  ping_bing: bool = True
```

**预估工时**：1 周

**优先级**：⭐⭐⭐⭐

### 3.4 用户体验优化

#### 🔲 深色模式增强

**需求描述**：
增强深色模式体验，提供更多主题选择。

**功能清单**：
- [ ] 跟随系统设置
- [ ] 记住用户偏好
- [ ] 定时自动切换（可选）
- [ ] 亮色主题选择（纯净白、护眼米白）
- [ ] 深色主题选择（深邃黑、护眼深灰）
- [ ] 强调色选择
- [ ] 主题预览功能
- [ ] 避免闪烁（FOUC）

**技术实现**：
```typescript
type Theme = 'light' | 'dark' | 'system';
type LightTheme = 'pure-white' | 'warm-cream';
type DarkTheme = 'deep-black' | 'eye-care-gray';
type AccentColor = 'blue' | 'purple' | 'green' | 'orange';

interface ThemeConfig {
  mode: Theme;
  lightTheme?: LightTheme;
  darkTheme?: DarkTheme;
  accentColor?: AccentColor;
  autoSwitchTime?: { start: string; end: string };
}
```

**预估工时**：1 周

**优先级**：⭐⭐⭐

#### 🔲 国际化（i18n）

**需求描述**：
支持多语言版本，扩大国际影响力。

**功能清单**：
- [ ] 英文版网站
- [ ] 中文/英文 URL 结构
- [ ] 文章多语言支持
- [ ] 标签多语言
- [ ] UI 界面多语言
- [ ] 语言切换器
- [ ] SEO 多语言优化

**技术方案**：
```typescript
// 使用 next-intl 或 react-i18next
interface I18nConfig {
  defaultLocale: 'zh-CN';
  locales: ['zh-CN', 'en'];
  
  // 翻译命名空间
  namespaces: ['common', 'posts', 'about'];
  
  // 文章翻译
  postTranslations: {
    post_id: string;
    locale: string;
    title: string;
    summary: string;
    content: string;
  };
}
```

**预估工时**：3-4 周

**优先级**：⭐⭐⭐

### 3.5 数据分析与运营

#### 🔲 高级统计分析

**需求描述**：
建立完整的数据分析体系，支持数据驱动决策。

**功能清单**：
- [ ] 页面访问追踪
- [ ] 文章阅读深度（scroll）
- [ ] 阅读时长统计
- [ ] 点击热图
- [ ] 用户行为路径
- [ ] 转化漏斗分析
- [ ] 留存分析
- [ ] 用户分群
- [ ] 流量来源分析
- [ ] 设备/地域分布
- [ ] 数据可视化仪表盘
- [ ] 数据导出（Excel/CSV）
- [ ] 自定义事件追踪

**技术架构**：
```
数据采集层：
├─ 前端埋点（SDK）
│  ├─ 页面浏览
│  ├─ 点击事件
│  ├─ 自定义事件
│  └─ 用户标识
│
├─ 服务端埋点
│  ├─ API 调用
│  ├─ 错误日志
│  └─ 性能监控
│
└─ 第三方数据
   ├─ Google Analytics
   ├─ 百度统计
   └─ 搜索引擎

数据存储层：
├─ 实时数据：Redis Stream
├─ 历史数据：PostgreSQL / ClickHouse
└─ 日志数据：Elasticsearch

数据分析层：
├─ 实时分析：Redis / Trino
├─ 离线分析：Apache Spark / Presto
└─ 可视化：Grafana / Metabase

数据应用层：
├─ 管理后台仪表盘
├─ 数据报告（每日/每周）
└─ 异常告警
```

**预估工时**：3-4 周

**优先级**：⭐⭐⭐⭐⭐

#### 🔲 用户画像与个性化

**需求描述**：
基于用户行为，提供个性化内容推荐。

**功能清单**：
- [ ] 用户行为采集
- [ ] 兴趣标签提取
- [ ] 用户分群
- [ ] 个性化推荐算法
- [ ] 推荐展示位置优化
- [ ] 推荐效果追踪
- [ ] A/B 测试框架

**技术方案**：
```python
class UserProfile(Base):
  id: Mapped[str]
  visitor_id: Mapped[str]
  
  # 兴趣标签（基于阅读历史）
  interests: Mapped[dict[str, float]] = {}  # {tag: score}
  
  # 阅读偏好
  preferences: Mapped[dict] = {
    'avg_read_time': 0,
    'preferred_length': 'medium',  # short/medium/long
    'liked_categories': [],
  }
  
  # 行为统计
  stats: Mapped[dict] = {
    'total_reads': 0,
    'total_likes': 0,
    'total_comments': 0,
    'total_shares': 0,
  }
  
  updated_at: Mapped[datetime]

class RecommendationEngine:
  # 协同过滤
  collaborative_filtering: bool = True
  
  # 基于内容
  content_based: bool = True
  
  # 热门推荐
  popularity_boost: float = 0.1
  
  # 新文章加成
  recency_boost: float = 0.2
```

**预估工时**：4-6 周

**优先级**：⭐⭐⭐⭐

### 3.6 搜索功能增强

#### 🔲 全文搜索引擎集成

**需求描述**：
集成专业搜索引擎，提升站内搜索体验。

**功能清单**：
- [ ] Meilisearch 集成
- [ ] 全文搜索（标题+正文）
- [ ] 搜索建议（自动补全）
- [ ] 搜索高亮
- [ ] 分页和排序
- [ ] 过滤器（项目、标签、日期）
- [ ] 相关搜索
- [ ] 搜索权重配置
- [ ] 搜索分析
- [ ] 同义词配置
- [ ] 中文分词优化

**技术实现**：
```python
# 后端搜索服务
class SearchService:
  engine = 'meilisearch'
  
  # 索引配置
  index_settings = {
    'posts': {
      'searchableAttributes': ['title', 'summary', 'content', 'tags'],
      'filterableAttributes': ['project_id', 'tags', 'status', 'created_at'],
      'sortableAttributes': ['created_at', 'view_count', 'like_count'],
      'rankingRules': ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
    }
  }
  
  # 中文分词
  tokenizer = 'jieba'
  
  # 搜索 API
  async def search_posts(query: str, filters: dict, page: int, size: int):
    # 实现搜索逻辑
    pass
  
  # 索引同步
  async def sync_to_search(post_id: str):
    # 发布/更新文章时同步
    pass
```

**预估工时**：2-3 周

**优先级**：⭐⭐⭐⭐

---

## 4. 功能优先级矩阵

### 4.1 优先级评估标准

| 优先级 | 标准 | 说明 |
|--------|------|------|
| ⭐⭐⭐⭐⭐ | P0 | 核心功能，影响主要内容产出 |
| ⭐⭐⭐⭐ | P1 | 高价值功能，提升用户体验 |
| ⭐⭐⭐ | P2 | 中价值功能，长期有益 |
| ⭐⭐ | P3 | 低价值功能，可做可不做 |
| ⭐ | P4 | 实验性功能，资源允许再做 |

### 4.2 功能优先级排序

| 优先级 | 功能名称 | 预估工时 | 价值评估 |
|--------|-----------|----------|----------|
| ⭐⭐⭐⭐⭐ | 邮件订阅系统 | 3-4 周 | 核心留存 |
| ⭐⭐⭐⭐⭐ | 高级统计分析 | 3-4 周 | 数据驱动 |
| ⭐⭐⭐⭐⭐ | 高级 SEO 优化 | 2-3 周 | 流量增长 |
| ⭐⭐⭐⭐ | 高级编辑器 | 2-3 周 | 写作效率 |
| ⭐⭐⭐⭐ | 相关文章推荐 | 1 周 | 停留提升 |
| ⭐⭐⭐⭐ | 评论系统升级 | 2-3 周 | 社区活跃 |
| ⭐⭐⭐⭐ | 全文搜索 | 2-3 周 | 搜索体验 |
| ⭐⭐⭐ | 定时发布 | 1-2 周 | 内容规划 |
| ⭐⭐⭐ | 深色模式增强 | 1 周 | 用户体验 |
| ⭐⭐⭐ | 收藏与分享 | 1 周 | 用户粘性 |
| ⭐⭐⭐ | 站点地图自动化 | 1 周 | SEO |
| ⭐⭐⭐ | 国际化 | 3-4 周 | 国际影响力 |
| ⭐⭐⭐ | 用户画像 | 4-6 周 | 个性化 |

---

## 5. 实施指南

### 5.1 开发环境准备

#### 后端开发
```bash
# 1. 安装依赖
cd backend
uv sync

# 2. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 配置数据库等

# 3. 初始化数据库
uv run python create_tables.py

# 4. 启动开发服务器
APP_ENV=local uv run uvicorn app.main:app --reload
```

#### 前端开发
```bash
# 1. 安装依赖
cd frontend
pnpm install

# 2. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 配置 API 地址等

# 3. 启动开发服务器
pnpm dev
```

### 5.2 功能开发流程

```
┌──────────────────────────────────────────────┐
│ 1. 需求分析                                   │
│ ├─ 明确功能需求                              │
│ ├─ 评估技术方案                              │
│ └─ 估算开发时间                              │
└──────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ 2. 技术设计                                   │
│ ├─ 设计数据模型（如需）                       │
│ ├─ 设计 API 接口                             │
│ ├─ 设计前端组件                              │
│ └─ 编写技术文档                              │
└──────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ 3. 后端开发                                   │
│ ├─ 创建数据模型（models/）                   │
│ ├─ 创建 DAO 层（dao/）                       │
│ ├─ 创建 Service 层（services/）              │
│ ├─ 创建 API 层（api/）                       │
│ └─ 编写单元测试                              │
└──────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ 4. 前端开发                                   │
│ ├─ 创建类型定义（types/）                     │
│ ├─ 创建 API 客户端（api/）                    │
│ ├─ 创建页面组件（app/）                       │
│ ├─ 创建通用组件（components/）               │
│ └─ 编写 E2E 测试                             │
└──────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ 5. 测试验收                                   │
│ ├─ 功能测试                                  │
│ ├─ 兼容性测试                                │
│ ├─ 性能测试                                  │
│ └─ 代码审查                                  │
└──────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ 6. 部署上线                                   │
│ ├─ 更新环境配置                              │
│ ├─ 执行数据库迁移                             │
│ ├─ 构建 Docker 镜像                           │
│ ├─ 部署到服务器                              │
│ └─ 验证服务运行                              │
└──────────────────────────────────────────────┘
```

### 5.3 代码规范

#### 后端代码规范
```python
# 命名规范
类名：PascalCase（PostService）
函数名：snake_case（create_post）
常量：UPPER_SNAKE_CASE（MAX_PAGE_SIZE）

# 分层规范
models/    # 数据模型（SQLAlchemy）
schemas/   # 数据验证（Pydantic）
dao/       # 数据访问
services/  # 业务逻辑
api/       # HTTP 接口

# API 响应格式
{
  "success": true,
  "data": {...},
  "error": null
}
```

#### 前端代码规范
```typescript
// 命名规范
组件名：PascalCase（PostCard）
函数名：camelCase（fetchPosts）
常量：UPPER_SNAKE_CASE（API_BASE_URL）

// 文件组织
app/           # Next.js App Router 页面
components/    # React 组件
api/           # API 客户端
hooks/         # 自定义 Hooks
types/         # TypeScript 类型
lib/           # 工具函数

# 组件规范
// 组件文件：PascalCase.tsx
// Props 接口：ComponentNameProps
// 使用函数组件而非类组件
```

### 5.4 测试策略

```
测试金字塔：
        ╱╲
       ╱  ╲
      ╱ E2E╲       ← 少量，端到端
     ╱──────╲
    ╱ 集成  ╲      ← 中量，模块集成
   ╱────────╲
  ╱  单元   ╲     ← 大量，函数/组件
 ╱──────────╲
```

**测试覆盖率目标**：
- 核心业务逻辑：≥ 80%
- API 端点：≥ 70%
- 前端组件：≥ 50%

### 5.5 部署检查清单

```
部署前检查：
□ 代码已提交并通过 CI
□ 所有测试通过
□ 数据库迁移脚本已准备
□ 环境变量已配置
□ 备份已创建

部署后检查：
□ 服务启动正常
□ 健康检查通过
□ 关键功能测试
□ 日志无异常
□ 监控告警正常
```

---

**文档结束**

> 📅 最后更新：2026-04-28  
> 👤 作者：李衡 (AhernLi)  
> 🔗 文档位置：`d:\code\ai\meblog\FEATURES.md`
