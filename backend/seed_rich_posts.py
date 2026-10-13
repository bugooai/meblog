#!/usr/bin/env python3
"""Seed demo posts with rich markdown features."""

from __future__ import annotations

from uuid import uuid4

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.models.admin import Admin
from app.models.post import Post
from app.models.project import Project
from app.models.tag import Tag


DATABASE_URL = "sqlite:///./meblog.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


POSTS = [
    {
        "title": "从 0 到 1 构建 AI 博客系统",
        "slug": "ai-blog-from-zero-to-one",
        "summary": "一篇覆盖项目、标签、Markdown、代码块、公式和列表的完整示例文章。",
        "project_slug": "ai-engineering",
        "tag_slugs": ["python", "fastapi", "markdown", "backend", "engineering"],
        "content": r"""# 从 0 到 1 构建 AI 博客系统

这是一篇用于验证渲染能力的文章，目标是展示：

- 标签绑定
- 项目归属
- Markdown 结构
- 代码高亮
- 数学公式
- 有序与无序列表

## 架构要点

1. 前端：Next.js 负责页面渲染
2. 后端：FastAPI 提供 REST API
3. 数据层：SQLite 存储文章、标签、项目

## 示例代码

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
async def health():
    return {"ok": True}
```

## 公式示例

行内公式：$f(x)=x^2+1$。

块级公式：

$$
\mathcal{L} = \frac{1}{N}\sum_{i=1}^{N}(y_i-\hat{y_i})^2
$$

## 任务清单

- [x] 支持 Markdown
- [x] 支持代码块
- [x] 支持数学公式
- [ ] 支持更多图表能力
""",
    },
    {
        "title": "全栈性能优化实战笔记",
        "slug": "fullstack-performance-notes",
        "summary": "用真实示例展示性能优化文章内容格式与项目标签关系。",
        "project_slug": "web-performance",
        "tag_slugs": ["nextjs", "performance", "sql", "frontend", "engineering"],
        "content": r"""# 全栈性能优化实战笔记

性能优化需要前后端协同推进。

## 优化优先级

1. 降低首屏阻塞资源
2. 减少不必要的 API 往返
3. 给数据库查询加索引

## SQL 示例

```sql
SELECT id, title, created_at
FROM posts
WHERE status = 'published'
ORDER BY created_at DESC
LIMIT 10;
```

## 公式估算

吞吐量估算：

$$
QPS \approx \frac{\text{并发数}}{\text{平均响应时延}}
$$

## 检查清单

- 缓存命中率是否提升
- 慢查询是否下降
- 页面交互是否更顺畅
""",
    },
    {
        "title": "数据科学工作流与可复现实践",
        "slug": "data-science-reproducible-workflow",
        "summary": "面向数据科学场景的文章模板，验证富文本能力与多标签管理。",
        "project_slug": "data-lab",
        "tag_slugs": ["python", "data-science", "math", "algorithm", "ai"],
        "content": r"""# 数据科学工作流与可复现实践

可复现是数据项目交付质量的基础。

## 推荐流程

- 明确问题定义与指标
- 固定数据抽样与随机种子
- 将实验配置版本化

## Python 代码示例

```python
import random
import numpy as np

SEED = 42
random.seed(SEED)
np.random.seed(SEED)

print("experiment seed:", SEED)
```

## 常见公式

标准化公式：

$$
z = \frac{x - \mu}{\sigma}
$$

## 发布前列表

1. 模型指标达到阈值
2. 数据漂移检查通过
3. 推理接口具备监控告警
""",
    },
    {
        "title": "后端工程化上线清单（可直接复用）",
        "slug": "backend-engineering-release-checklist",
        "summary": "从配置、迁移、监控到回滚，整理后端工程化上线的可执行清单。",
        "project_slug": "ai-engineering",
        "tag_slugs": ["backend", "engineering", "sql", "fastapi"],
        "content": r"""# 后端工程化上线清单（可直接复用）

这篇文章用于演示中文标签分类，例如：`后端`、`工程化`。

## 上线前检查

1. 环境变量与密钥确认
2. 数据库迁移脚本演练
3. 关键接口压测与告警

## FastAPI 健康检查示例

```python
from fastapi import APIRouter

router = APIRouter()

@router.get("/healthz")
async def healthz():
    return {"status": "ok", "service": "backend"}
```

## 风险评估公式

$$
\text{风险分} = \text{影响范围} \times \text{发生概率}
$$

## 回滚策略

- 保留上一个稳定镜像
- 迁移脚本支持向下回退
- 发布后 30 分钟重点观察错误率
""",
    },
    {
        "title": "前端交互优化：从卡顿到丝滑",
        "slug": "frontend-interaction-optimization-guide",
        "summary": "结合列表渲染与状态更新策略，展示前端性能优化思路。",
        "project_slug": "web-performance",
        "tag_slugs": ["frontend", "performance", "nextjs", "product"],
        "content": r"""# 前端交互优化：从卡顿到丝滑

这篇文章用于演示中文标签分类，例如：`前端`、`产品`。

## 优化目标

- 降低首屏渲染时间
- 减少列表重复渲染
- 提升输入响应速度

## React 列表优化示例

```tsx
import { memo } from "react";

const Row = memo(function Row({ title }: { title: string }) {
  return <li>{title}</li>;
});
```

## 延迟估算

行内公式：$T_{total}=T_{network}+T_{render}+T_{script}$。

块级公式：

$$
\Delta UX \propto \frac{1}{\text{交互延迟}}
$$

## 功能验收列表

1. 页面滚动稳定无明显掉帧
2. 切换筛选条件响应 < 200ms
3. 移动端交互流畅
""",
    },
]


PROJECTS = [
    ("ai-engineering", "AI 工程"),
    ("web-performance", "Web 性能"),
    ("data-lab", "数据实验室"),
]


TAGS = [
    ("python", "Python"),
    ("fastapi", "FastAPI"),
    ("markdown", "Markdown"),
    ("nextjs", "Next.js"),
    ("performance", "Performance"),
    ("sql", "SQL"),
    ("data-science", "Data Science"),
    ("math", "Math"),
    ("backend", "后端"),
    ("frontend", "前端"),
    ("algorithm", "算法"),
    ("engineering", "工程化"),
    ("ai", "AI"),
    ("product", "产品"),
]


def get_or_create_admin(db: Session) -> Admin:
    admin = db.execute(select(Admin).where(Admin.username == "seed-admin")).scalar_one_or_none()
    if admin:
        return admin

    admin = Admin(
        id=str(uuid4()),
        username="seed-admin",
        email="seed-admin@example.com",
        password_hash="seed-not-for-login",
        is_admin=True,
    )
    db.add(admin)
    db.flush()
    return admin


def get_or_create_project(db: Session, slug: str, name: str, actor_id: str) -> Project:
    project = db.execute(select(Project).where(Project.slug == slug)).scalar_one_or_none()
    if project:
        return project

    project = Project(
        id=str(uuid4()),
        slug=slug,
        name=name,
        created_by=actor_id,
        updated_by=actor_id,
    )
    db.add(project)
    db.flush()
    return project


def get_or_create_tag(db: Session, slug: str, name: str, actor_id: str) -> Tag:
    tag = db.execute(select(Tag).where(Tag.slug == slug)).scalar_one_or_none()
    if tag:
        return tag

    tag = Tag(
        id=str(uuid4()),
        slug=slug,
        name=name,
        created_by=actor_id,
        updated_by=actor_id,
    )
    db.add(tag)
    db.flush()
    return tag


def upsert_post(db: Session, actor_id: str, project_map: dict[str, Project], tag_map: dict[str, Tag], post_data: dict) -> None:
    existing = db.execute(select(Post).where(Post.slug == post_data["slug"])).scalar_one_or_none()
    if existing:
        post = existing
        post.title = post_data["title"]
        post.summary = post_data["summary"]
        post.content = post_data["content"]
        post.project_id = project_map[post_data["project_slug"]].id
        post.status = "published"
        post.updated_by = actor_id
        post.tags = [tag_map[slug] for slug in post_data["tag_slugs"]]
        return

    post = Post(
        id=str(uuid4()),
        title=post_data["title"],
        slug=post_data["slug"],
        summary=post_data["summary"],
        content=post_data["content"],
        status="published",
        user_id=actor_id,
        created_by=actor_id,
        updated_by=actor_id,
        project_id=project_map[post_data["project_slug"]].id,
    )
    post.tags = [tag_map[slug] for slug in post_data["tag_slugs"]]
    db.add(post)


def main() -> None:
    with SessionLocal() as db:
        admin = get_or_create_admin(db)

        project_map: dict[str, Project] = {}
        for slug, name in PROJECTS:
            project_map[slug] = get_or_create_project(db, slug, name, admin.id)

        tag_map: dict[str, Tag] = {}
        for slug, name in TAGS:
            tag_map[slug] = get_or_create_tag(db, slug, name, admin.id)

        for post_data in POSTS:
            upsert_post(db, admin.id, project_map, tag_map, post_data)

        db.commit()
        print(f"Seeded {len(POSTS)} posts, {len(PROJECTS)} projects, {len(TAGS)} tags.")


if __name__ == "__main__":
    main()
