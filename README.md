# meblog

A personal tech blog built with Next.js + FastAPI.

## Tech Stack

**Frontend**
- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS 4
- TanStack Query
- pnpm

**Backend**
- FastAPI
- SQLAlchemy (async)
- PostgreSQL / SQLite
- uv

## Features

- 📝 Markdown 文章编写
- 🏷️ 标签与项目分类
- 👍 点赞功能
- 🌙 Light/Dark Mode
- 📱 响应式设计

## Development

```bash
# Frontend
cd frontend
pnpm install
pnpm dev

# Backend
cd backend
uv sync
APP_ENV=local uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

隐藏可见性回归脚本（后端）：
- 写入型（会创建测试数据）：`backend/tests/hidden_visibility_regression.sh`
- 只读型（不改数据）：`backend/tests/hidden_visibility_readonly_check.sh`
- 使用说明：`backend/tests/README_hidden_visibility_tests.md`

本地开发统一使用 `local`：
- 后端：`APP_ENV=local`，读取 `backend/.env.local`
- 前端：`NEXT_PUBLIC_ENV` 不设置或为 `local`，默认读取 `frontend/.env.local`

## Deployment

`deploy.sh` 建议基于 `deploy.sh.example` 创建，并通过环境变量传入部署配置，不在脚本中硬编码敏感信息。

```bash
# 1) 准备脚本
cp deploy.sh.example deploy.sh
chmod +x deploy.sh

# 2) 注入部署参数（按你的服务器实际值修改）
export SERVER_IP="x.x.x.x"
export SERVER_USER="root"
export SERVER_PASS="your-password"
export PROJECT_ROOT="/root/code/projects/meblog"

# 3) 执行部署（脚本会先部署后端，再部署前端）
./deploy.sh test
# 或
./deploy.sh production
```

环境选择规则：

后端按 `APP_ENV` 自动读取：
- `APP_ENV=local` -> `backend/.env.local`
- `APP_ENV=test` -> `backend/.env.test`
- `APP_ENV=production` -> `backend/.env.production`

前端按 `NEXT_PUBLIC_ENV` 自动读取：
- `NEXT_PUBLIC_ENV=test` -> `frontend/.env.test`
- `NEXT_PUBLIC_ENV=production` -> `frontend/.env.production`
- 默认（未设置或其他值）-> `frontend/.env.local`

推荐约定：
- 本地开发：`local`
- 服务器部署：`test` / `production`

## API Endpoints

- `GET /api/v1/posts` - 获取文章列表
- `GET /api/v1/posts/{slug}` - 获取文章详情
- `POST /api/v1/posts/{slug}/like` - 点赞
- `GET /api/v1/tags` - 获取标签
- `GET /api/v1/projects` - 获取项目

## License

Copyright 2026 布谷布谷科技

Licensed under the Apache License, Version 2.0.
See [LICENSE](LICENSE) for details.
