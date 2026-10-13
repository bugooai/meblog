# Meblog PRD - 产品需求文档

> **文档版本**: v1.0.0  
> **创建时间**: 2026-04-06  
> **最后更新**: 2026-04-19

---

## 1. 产品概述

### 1.1 基本信息
- **项目名称**: Meblog
- **项目类型**: 个人博客网站
- **项目代号**: meblog
- **版本号**: v1.0.0

### 1.2 核心功能
个人博客系统，支持博主撰写、发布、管理文章，并提供公开访问的博客阅读界面。

### 1.3 目标用户
- 博主 / 技术写作者
- 希望拥有独立博客的个人

### 1.4 产品边界（v1.0.0）
**包含：**
- 文章管理（CRUD）
- 项目 & 标签管理（注意：原"分类"概念已统一为"项目"）
- 用户认证
- 博客前台展示
- 评论功能（基础版）

**不包含：**
- 多作者支持（v1.0.0 为单博主）
- 图片上传（使用外部图床）
- SEO 优化高级功能

---

## 2. 技术栈

### 2.1 前端
| 技术 | 版本 | 说明 |
|------|------|------|
| TypeScript | ^5.0 | 类型安全 |
| React | ^18.0 | UI 框架 |
| Next.js | ^16.0 | 全栈框架（App Router）|
| TailwindCSS | ^3.0 | 原子化 CSS |
| React Query | ^5.0 | 数据请求/缓存 |
| React Markdown | ^9.0 | Markdown 渲染 |
| react-syntax-highlighter | ^5.0 | 代码语法高亮 |
| react-katex | ^3.0 | 数学公式渲染（KaTeX）|

### 2.2 后端
| 技术 | 版本 | 说明 |
|------|------|------|
| Python | ^3.12 | 运行环境 |
| uv | latest | 包管理器 |
| FastAPI | ^0.110 | Web 框架 |
| SQLAlchemy | ^2.0 | ORM |
| Pydantic | ^2.0 | 数据验证 |
| python-jose | ^3.3 | JWT 认证 |
| passlib | ^1.7 | 密码加密 |

### 2.3 数据库
| 技术 | 说明 |
|------|------|
| PostgreSQL | 开发/测试/生产环境统一 |

### 2.4 基础设施
- 前端部署：Vercel / 自建服务器
- 后端部署：自建服务器（Docker）
- 域名：自定义域名
- 中间件：Redis（缓存）、PostgreSQL（数据库）- 在服务器上独立维护

---

## 3. 功能需求

### 3.1 文章管理

#### 3.1.1 创建文章
- 字段：标题、别名(slug)、正文、摘要、项目、标签、状态
- 标题：必填，最大 200 字符
- 正文：Markdown 格式，必填
- 摘要：选填，最大 500 字符，不填则自动截取正文前 200 字
- 别名：URL 友好格式，自动从标题生成，支持手动修改，唯一
- 项目：必填，单选（原"分类"概念）
- 标签：选填，多选
- 状态：`draft`（草稿）/ `published`（已发布）

#### 3.1.2 编辑文章
- 所有字段均可编辑
- 修改已发布文章不影响已访问用户

#### 3.1.3 删除文章
- 软删除（标记为 deleted），不物理删除数据
- 删除后前台不展示

#### 3.1.4 文章列表
- 分页展示，每页 10 篇
- 支持按项目筛选
- 支持按标签筛选
- 支持关键词搜索（标题/正文）
- 按创建时间倒序排列

#### 3.1.5 文章详情
- 展示完整文章内容
- Markdown 渲染（代码高亮、表格、图片）
- **代码高亮**：支持主流编程语言语法高亮（Python、JavaScript、TypeScript、Go 等）
- **数学公式**：支持 LaTeX 语法渲染（行内公式 $...$ + 块级公式 $$...$$）
- 阅读量 +1

### 3.2 项目管理（原分类管理）

#### 3.2.1 项目列表
- 展示所有项目及文章数量
- 支持新增、编辑、删除项目

#### 3.2.2 项目字段
- 名称：必填，最大 50 字符，唯一
- 别名：自动从名称生成，唯一

#### 3.2.3 删除约束
- 项目下有文章时不允许删除，需先转移文章

### 3.3 标签管理

#### 3.3.1 标签列表
- 展示所有标签及文章数量
- 支持新增、编辑、删除标签

#### 3.3.2 标签字段
- 名称：必填，最大 50 字符，唯一
- 别名：自动从名称生成，唯一

### 3.4 用户与认证

#### 3.4.1 用户注册
- 字段：用户名、邮箱、密码
- 用户名：3-20 字符，字母/数字/下划线
- 邮箱：有效邮箱格式，唯一
- 密码：最小 8 字符，需包含字母和数字

#### 3.4.2 用户登录
- 方式：用户名或邮箱 + 密码
- 返回 JWT Access Token
- Token 有效期：7 天

#### 3.4.3 JWT 认证
- 使用 Bearer Token
- 需认证的操作：创建/编辑/删除文章、项目、标签
- 无需认证：注册、登录、浏览博客前台

#### 3.4.4 个人资料
- 查看/编辑个人资料
- 修改密码

### 3.5 评论功能

#### 3.5.1 评论列表
- 按时间倒序展示
- 支持分页

#### 3.5.2 发布评论
- 需要登录
- 支持 Markdown 格式

#### 3.5.3 评论管理
- 作者可删除自己的评论

### 3.6 前台展示

#### 3.6.1 首页
- 博客名称 & 副标题
- 最新文章列表（分页）
- 侧边栏：项目列表、标签列表

#### 3.6.2 文章详情页
- 文章标题、发布时间、项目、标签
- Markdown 渲染正文
- 阅读量
- 评论区域

#### 3.6.3 项目页
- 项目名称
- 该项目下的文章列表

#### 3.6.4 标签页
- 标签名称
- 该标签下的文章列表

#### 3.6.5 关于页面
- 静态关于页面
- 博主介绍

---

## 4. 数据模型

### 4.1 数据库 ER 图

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   User      │       │    Post     │       │   Project   │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │       │ id (PK)     │       │ id (PK)     │
│ username    │       │ title       │       │ name        │
│ email       │       │ slug        │       │ slug        │
│ password    │       │ content     │       └─────────────┘
│ created_at  │       │ summary     │              │
└─────────────┘       │ view_count  │              │
                      │ status      │              │
                      │ created_at  │              │
                      │ updated_at  │              │
                      │ user_id(FK) │◄────────────┘
                      │ project_id │
                      └─────────────┘
                            │
                            │
                      ┌─────────────┐
                      │    Tag      │
                      ├─────────────┤
                      │ id (PK)     │
                      │ name        │
                      │ slug        │
                      └─────────────┘
                            │
                     ┌──────────────┐
                     │  PostTag     │
                     │ (M2M关联表)  │
                     ├──────────────┤
                     │ post_id (FK) │
                     │ tag_id (FK)  │
                     └──────────────┘
                            │
                     ┌──────────────┐
                     │   Comment    │
                     ├──────────────┤
                     │ id (PK)      │
                     │ content      │
                     │ post_id (FK) │
                     │ user_id (FK) │
                     │ created_at   │
                     └──────────────┘
```

### 4.2 数据表详细设计

#### users
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK, AUTO | 主键 |
| username | VARCHAR(50) | UNIQUE, NOT NULL | 用户名 |
| email | VARCHAR(255) | UNIQUE, NOT NULL | 邮箱 |
| password_hash | VARCHAR(255) | NOT NULL | 密码哈希 |
| created_at | DATETIME | NOT NULL | 创建时间 |
| updated_at | DATETIME | NOT NULL | 更新时间 |

#### projects
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK, AUTO | 主键 |
| name | VARCHAR(50) | UNIQUE, NOT NULL | 项目名 |
| slug | VARCHAR(50) | UNIQUE, NOT NULL | URL别名 |
| created_at | DATETIME | NOT NULL | 创建时间 |

#### tags
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK, AUTO | 主键 |
| name | VARCHAR(50) | UNIQUE, NOT NULL | 标签名 |
| slug | VARCHAR(50) | UNIQUE, NOT NULL | URL别名 |
| created_at | DATETIME | NOT NULL | 创建时间 |

#### posts
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK, AUTO | 主键 |
| title | VARCHAR(200) | NOT NULL | 标题 |
| slug | VARCHAR(200) | UNIQUE, NOT NULL | URL别名 |
| content | TEXT | NOT NULL | 正文 |
| summary | TEXT | | 摘要 |
| view_count | INTEGER | DEFAULT 0 | 阅读量 |
| status | VARCHAR(20) | DEFAULT 'draft' | 状态 |
| is_deleted | BOOLEAN | DEFAULT FALSE | 软删除标记 |
| user_id | INTEGER | FK(users.id), NOT NULL | 作者 |
| project_id | INTEGER | FK(projects.id), NOT NULL | 项目 |
| created_at | DATETIME | NOT NULL | 创建时间 |
| updated_at | DATETIME | NOT NULL | 更新时间 |

#### post_tags (关联表)
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| post_id | INTEGER | FK(posts.id) | 文章ID |
| tag_id | INTEGER | FK(tags.id) | 标签ID |
| PRIMARY KEY (post_id, tag_id) | | | 联合主键 |

#### comments
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK, AUTO | 主键 |
| content | TEXT | NOT NULL | 评论内容 |
| post_id | INTEGER | FK(posts.id), NOT NULL | 文章ID |
| user_id | INTEGER | FK(users.id), NOT NULL | 用户ID |
| created_at | DATETIME | NOT NULL | 创建时间 |

---

## 5. API 设计

> **Base URL**: `/api/v1`  
> **认证方式**: Bearer Token (JWT)  
> **内容类型**: application/json

### 5.1 认证相关

#### POST /auth/register - 用户注册
**Request:**
```json
{
  "username": "admin",
  "email": "admin@example.com",
  "password": "***"
}
```
**Response (201):**
```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@example.com",
  "created_at": "2026-04-06T12:00:00Z"
}
```

#### POST /auth/login - 用户登录
**Request:**
```json
{
  "username": "admin",
  "password": "***"
}
```
**Response (200):**
```json
{
  "access_token": "eyJhbG...s...",
  "token_type": "bearer"
}
```

#### GET /auth/me - 获取当前用户
**Headers:** `Authorization: Bearer ***  
**Response (200):**
```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@example.com",
  "created_at": "2026-04-06T12:00:00Z"
}
```

### 5.2 文章相关

#### GET /posts - 获取文章列表
**Query Parameters:**
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | int | 1 | 页码 |
| size | int | 10 | 每页数量 |
| project | string | | 项目 slug |
| tag | string | | 标签 slug |
| q | string | | 搜索关键词 |

**Response (200):**
```json
{
  "items": [
    {
      "id": 1,
      "title": "我的第一篇文章",
      "slug": "my-first-post",
      "summary": "这是摘要...",
      "view_count": 100,
      "status": "published",
      "created_at": "2026-04-06T12:00:00Z",
      "project": {
        "id": 1,
        "name": "技术",
        "slug": "tech"
      },
      "tags": [
        {"id": 1, "name": "Python", "slug": "python"}
      ]
    }
  ],
  "total": 50,
  "page": 1,
  "size": 10,
  "pages": 5
}
```

#### GET /posts/{id_or_slug} - 获取文章详情
**Response (200):**
```json
{
  "id": 1,
  "title": "我的第一篇文章",
  "slug": "my-first-post",
  "content": "## Markdown 正文...",
  "summary": "这是摘要...",
  "view_count": 101,
  "status": "published",
  "created_at": "2026-04-06T12:00:00Z",
  "updated_at": "2026-04-06T12:00:00Z",
  "project": {
    "id": 1,
    "name": "技术",
    "slug": "tech"
  },
  "tags": [
    {"id": 1, "name": "Python", "slug": "python"}
  ],
  "author": {
    "id": 1,
    "username": "admin"
  }
}
```

#### POST /posts - 创建文章
**Headers:** `Authorization: Bearer ***  
**Request:**
```json
{
  "title": "我的第一篇文章",
  "content": "## Markdown 正文...",
  "summary": "这是摘要",
  "project_id": 1,
  "tag_ids": [1, 2],
  "status": "published"
}
```
**Response (201):** 同 GET /posts/{id}

#### PUT /posts/{id} - 更新文章
**Headers:** `Authorization: Bearer ***  
**Request:** 同 POST（所有字段可选）  
**Response (200):** 同 GET /posts/{id}

#### DELETE /posts/{id} - 删除文章（软删除）
**Headers:** `Authorization: Bearer ***  
**Response (204):** No Content

### 5.3 项目相关

#### GET /projects - 获取项目列表
**Response (200):**
```json
[
  {"id": 1, "name": "技术", "slug": "tech", "post_count": 10},
  {"id": 2, "name": "生活", "slug": "life", "post_count": 5}
]
```

#### POST /projects - 创建项目
**Headers:** `Authorization: Bearer ***  
**Request:**
```json
{
  "name": "技术"
}
```
**Response (201):**
```json
{
  "id": 1,
  "name": "技术",
  "slug": "tech",
  "created_at": "2026-04-06T12:00:00Z"
}
```

#### PUT /projects/{id} - 更新项目
**Headers:** `Authorization: Bearer ***  
**Request:** `{"name": "新技术"}`  
**Response (200):** 同 POST

#### DELETE /projects/{id} - 删除项目
**Headers:** `Authorization: Bearer ***  
**Response (204):** No Content  
**Error (400):** 项目下有文章时返回错误

### 5.4 标签相关

#### GET /tags - 获取标签列表
**Response (200):**
```json
[
  {"id": 1, "name": "Python", "slug": "python", "post_count": 8},
  {"id": 2, "name": "React", "slug": "react", "post_count": 3}
]
```

#### POST /tags - 创建标签
**Headers:** `Authorization: Bearer ***  
**Request:** `{"name": "Python"}`  
**Response (201):** 同 GET

#### PUT /tags/{id} - 更新标签
**Headers:** `Authorization: Bearer ***  
**Request:** `{"name": "Python3"}`  
**Response (200):** 同 POST

#### DELETE /tags/{id} - 删除标签
**Headers:** `Authorization: Bearer ***  
**Response (204):** No Content

### 5.5 评论相关

#### GET /posts/{post_slug}/comments - 获取评论列表
**Response (200):**
```json
[
  {
    "id": 1,
    "content": "很好的文章！",
    "created_at": "2026-04-19T10:00:00Z",
    "user": {
      "id": 1,
      "username": "reader1"
    }
  }
]
```

#### POST /posts/{post_slug}/comments - 发布评论
**Headers:** `Authorization: Bearer ***  
**Request:**
```json
{
  "content": "很好的文章！"
}
```
**Response (201):** 同 GET

#### DELETE /comments/{id} - 删除评论
**Headers:** `Authorization: Bearer ***  
**Response (204):** No Content

### 5.6 错误响应格式
```json
{
  "detail": "Error message here"
}
```

| HTTP Code | 说明 |
|-----------|------|
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 422 | 数据验证失败 |
| 500 | 服务器错误 |

---

## 6. 页面设计

### 6.1 前台页面（公开访问）

#### 首页 /
- 顶部：博客名称 + 导航（首页/项目/标签/关于）
- 主内容区：
  - 博客副标题/介绍
  - 文章卡片列表（标题、摘要、发布时间、项目、阅读量）
  - 底部分页导航
- 侧边栏：
  - 项目列表（带文章数）
  - 标签列表（带文章数）
  - 博主信息卡片

#### 文章详情页 /post/{slug}
- 顶部：返回链接 + 文章标题
- 元信息：发布时间、项目链接、标签链接、阅读量
- 正文：Markdown 渲染（代码高亮、表格、图片）
- **代码块**：语法高亮 + 复制按钮
- **数学公式**：KaTeX 渲染（行内/块级）
- 评论区域
- 底部：上一篇/下一篇导航

#### 项目页 /project/{slug}
- 顶部：项目名称 + 文章数量
- 文章列表（同首页文章列表）

#### 标签页 /tag/{slug}
- 顶部：标签名称 + 文章数量
- 文章列表（同首页文章列表）

#### 关于页面 /about
- 静态内容页面
- 博主介绍、联系方式等

### 6.2 管理后台（需登录）

#### 仪表盘 /admin
- 欢迎信息
- 快捷统计：文章数、项目数、标签数
- 最近发布的文章

#### 文章管理 /admin/posts
- 文章列表（标题、状态、发布时间、操作按钮）
- 筛选：状态（全部/已发布/草稿）
- 操作：新建、编辑、删除

#### 新建/编辑文章 /admin/posts/new 或 /admin/posts/{id}/edit
- 标题输入框
- 别名输入框（自动生成，支持手动修改）
- Markdown 编辑器（左右分栏：编辑/预览）
- 摘要输入框
- 项目下拉选择
- 标签多选
- 状态切换（草稿/发布）
- 保存/取消按钮

#### 项目管理 /admin/projects
- 项目表格（名称、别名、文章数、操作）
- 新建项目弹窗

#### 标签管理 /admin/tags
- 标签表格（名称、别名、文章数、操作）
- 新建标签弹窗

#### 登录页 /login
- 用户名/邮箱输入框
- 密码输入框
- 登录按钮
- 注册链接

#### 注册页 /register
- 用户名、邮箱、密码、确认密码
- 注册按钮
- 登录链接

---

## 7. 项目结构

```
meblog/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI 入口
│   │   ├── configs/             # Pydantic 配置管理
│   │   │   ├── __init__.py
│   │   │   ├── base.py
│   │   │   ├── development.py
│   │   │   ├── test.py
│   │   │   └── production.py
│   │   ├── database.py          # 数据库连接
│   │   ├── models/               # SQLAlchemy 模型
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── post.py
│   │   │   ├── project.py       # 原 category.py，现为 project
│   │   │   ├── tag.py
│   │   │   └── comment.py
│   │   ├── schemas/             # Pydantic 模型
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── post.py
│   │   │   ├── project.py
│   │   │   ├── tag.py
│   │   │   └── comment.py
│   │   ├── api/                 # API 路由（绝对导入）
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── posts.py
│   │   │   ├── projects.py      # 原 categories.py
│   │   │   ├── tags.py
│   │   │   ├── settings.py
│   │   │   ├── stats.py
│   │   │   ├── about.py
│   │   │   ├── comments.py
│   │   │   └── seo.py
│   │   ├── services/            # 业务逻辑层
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py
│   │   │   ├── post_service.py
│   │   │   ├── project_service.py
│   │   │   ├── tag_service.py
│   │   │   ├── comment_service.py
│   │   │   └── security.py
│   │   ├── dao/                 # 数据访问层（直接调用，无 CRUD 层）
│   │   │   ├── __init__.py
│   │   │   ├── user_dao.py
│   │   │   ├── post_dao.py
│   │   │   ├── project_dao.py
│   │   │   ├── tag_dao.py
│   │   │   └── comment_dao.py
│   │   └── utils/                # 工具函数
│   │       ├── __init__.py
│   │       ├── slug.py           # Slug 生成
│   │       └── pagination.py     # 分页工具
│   ├── scripts/                  # 脚本
│   │   └── add_posts.py
│   ├── tests/                    # 测试
│   ├── alembic/                  # 数据库迁移
│   ├── pyproject.toml            # 项目配置（uv）
│   ├── .env                      # 环境变量模板（gitignored）
│   ├── .env.test                 # 测试环境配置
│   ├── .env.production           # 生产环境配置
│   └── README.md
│
├── frontend/
│   ├── src/                     # 原 next-frontend/ 目录重命名
│   │   ├── app/                 # Next.js App Router
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx         # 首页
│   │   │   ├── post/
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx # 文章详情
│   │   │   ├── project/
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx # 项目页
│   │   │   ├── tag/
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx # 标签页
│   │   │   ├── about/
│   │   │   │   └── page.tsx     # 关于页面
│   │   │   └── admin/           # 管理后台
│   │   ├── components/          # 公共组件
│   │   │   ├── Layout.tsx
│   │   │   ├── Navbar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── PostCard.tsx
│   │   │   ├── ClientPosts.tsx
│   │   │   └── ...              # 其他组件
│   │   ├── api/                 # API 客户端
│   │   │   ├── client.ts
│   │   │   ├── auth.ts
│   │   │   ├── posts.ts
│   │   │   ├── projects.ts      # 原 categories.ts
│   │   │   ├── tags.ts
│   │   │   └── comments.ts
│   │   ├── types/               # TypeScript 类型
│   │   │   └── index.ts
│   │   ├── styles/              # 全局样式
│   │   │   └── globals.css
│   │   └── ...                  # 其他 Next.js 配置文件
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── README.md
│
├── docs/
│   ├── PRD.md                   # 产品需求文档
│   └── README.md
│
└── docker-compose.yml           # 仅包含 meblog-backend 服务
```

---

## 8. 路由汇总

### 前台路由
| 路径 | 页面 | 权限 |
|------|------|------|
| / | 首页 | 公开 |
| /post/{slug} | 文章详情 | 公开 |
| /project/{slug} | 项目文章 | 公开 |
| /tag/{slug} | 标签文章 | 公开 |
| /about | 关于页面 | 公开 |
| /login | 登录 | 公开 |
| /register | 注册 | 公开 |

### 后台路由
| 路径 | 页面 | 权限 |
|------|------|------|
| /admin | 仪表盘 | 需登录 |
| /admin/posts | 文章列表 | 需登录 |
| /admin/posts/new | 新建文章 | 需登录 |
| /admin/posts/{id}/edit | 编辑文章 | 需登录 |
| /admin/projects | 项目管理 | 需登录 |
| /admin/tags | 标签管理 | 需登录 |

---

## 9. Docker 部署说明

### 9.1 docker-compose.yml 结构
```yaml
version: '3.8'

services:
  meblog-backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - ENV=production
    networks:
      - common-network  # 使用服务器上的外部网络
    depends_on: []      # 不依赖 pg/redis，它们在服务器上独立运行

networks:
  common-network:
    external: true      # 引用服务器上已存在的网络
```

### 9.2 服务器环境要求
- **PostgreSQL**: 运行在端口 6001，数据库名 meblog
- **Redis**: 运行在端口 6379，用于缓存
- **Docker Network**: common-network 已创建
- **环境变量**: 通过 .env.production 配置

---

## 10. 进度跟踪

### v1.0.0 开发任务
- [x] PRD 文档完成（更新版）
- [x] 项目初始化
  - [x] 后端项目创建 & 依赖安装
  - [x] 前端项目创建 & 依赖安装（Next.js 16）
  - [x] Git 初始化
- [x] 后端开发
  - [x] 数据库模型创建（Project 替代 Category）
  - [x] 数据库迁移配置
  - [x] 认证模块（注册/登录/JWT）
  - [x] 项目 CRUD
  - [x] 标签 CRUD
  - [x] 文章 CRUD
  - [x] 评论功能
  - [x] API 测试
- [x] 前端开发
  - [x] 项目基础配置（Next.js 16 + Tailwind + React Query）
  - [x] 认证相关页面
  - [x] 前台公共组件（Layout、Navbar、Sidebar）
  - [x] 首页开发
  - [x] 文章详情页开发
  - [x] 项目/标签页开发
  - [x] 关于页面开发
  - [x] 管理后台页面
  - [x] Markdown 编辑器（完整版，含数学公式）
- [x] 前后端联调
- [ ] 部署上线（待完成）

---

## 11. 附录

### 11.1 常用命令

**后端：**
```bash
cd backend
uv sync                     # 安装依赖（使用 Python 3.12）
uv run uvicorn app.main:app --reload --port 8000  # 启动开发服务器
```

**前端：**
```bash
cd frontend
npm install
npm run dev           # 开发模式
npm run build         # 生产构建
npm start             # 启动生产服务器
```

### 11.2 环境变量

**后端 (.env）：**
```
ENV=development
DATABASE_URL=postgresql://memblog:memblog@116.62.176.216:6001/memblog
REDIS_URL=redis://116.62.176.216:6379/0
SECRET_KEY=your-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=10080
```

**前端 (.env.local)：**
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

**前端 (.env.production)：**
```
NEXT_PUBLIC_API_BASE_URL=http://116.62.176.216:8000/api/v1
```

### 11.3 开发规范

- Git 分支：main（稳定）、dev（开发）
- Commit 规范：feat/fix/docs/style/refactor/test/chore
- API 命名：RESTful 风格，复数名词
- 代码格式化：Prettier（前端）、Black（后端）
- **后端导入规范**：全部使用绝对路径导入（from app.models import Project）
- **前端目录规范**：src/ 目录包含所有源码，删除 src-old/