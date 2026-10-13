#!/usr/bin/env python3
"""Fix escaped backticks in all post content."""

import sqlite3

posts_content = {
    "python-异步编程完全指南": """## 什么是异步编程？

异步编程是一种并发模型，允许程序在等待 I/O 操作完成时继续执行其他任务。

## async/await 语法

```python
import asyncio

async def fetch_data():
    await asyncio.sleep(1)
    return "data"

async def main():
    result = await fetch_data()
    print(result)

asyncio.run(main())
```

## 异步 vs 同步

| 特性 | 同步 | 异步 |
|------|------|------|
| 性能 | 低 | 高 |
| 复杂度 | 低 | 高 |
| 适用场景 | CPU密集 | I/O密集 |

## 最佳实践

1. 不要在异步函数中使用同步阻塞操作
2. 使用 `asyncio.gather()` 并发执行多个任务
3. 合理使用信号量控制并发数量""",

    "react-18-new-features": """## Concurrent Mode

React 18 引入了并发模式，让渲染可以被中断和恢复。

## Automatic Batching

自动批处理减少了不必要的重新渲染：

```jsx
setTimeout(() => {
  setCount(c => c + 1);
  setFlag(f => !f);
  // 只触发一次重新渲染
}, 1000);
```

## Suspense for Data Fetching

```jsx
function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Comments />
    </Suspense>
  );
}
```

## useTransition

```jsx
import { useTransition } from 'react';

function App() {
  const [isPending, startTransition] = useTransition();

  startTransition(() => {
    setTab('posts');
  });
}
```""",

    "typescript-高级类型技巧": """## 条件类型

```typescript
type IsString<T> = T extends string ? true : false;

type A = IsString<"hello">; // true
type B = IsString<123>;    // false
```

## 映射类型

```typescript
type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};

type Optional<T> = {
  [P in keyof T]?: T[P];
};
```

## 模板字面量类型

```typescript
type EventName = `on${Capitalize<string>}`;
type ButtonEvent = EventName; // "onClick" | "onFocus" | ...
```

## 递归类型

```typescript
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? DeepReadonly<T[P]>
    : T[P];
};
```""",

    "fastapi-high-performance-web": """## 为什么选择 FastAPI？

- 🚀 性能卓越（与 Node.js 和 Go 相当）
- 📝 自动生成 OpenAPI 文档
- ✅ 类型安全

## 基础示例

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello World"}
```

## 请求体验证

```python
from pydantic import BaseModel

class User(BaseModel):
    name: str
    email: str
    age: int

@app.post("/users")
async def create_user(user: User):
    return user
```

## 依赖注入

```python
from fastapi import Depends

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/items")
async def get_items(db = Depends(get_db)):
    return db.query(Item).all()
```""",

    "sqlalchemy-2-guide": """## ORM vs Core

SQLAlchemy 2.0 统一了 ORM 和 Core 的使用体验。

## 定义模型

```python
from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50))
    posts: Mapped[list["Post"]] = relationship(back_populates="author")
```

## 查询

```python
# 新式查询
session.execute(
    select(User).where(User.name == "Alice")
).scalars().all()
```

## 关系

```python
class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    author: Mapped["User"] = relationship(back_populates="posts")
```""",

    "docker-容器化部署实战": """## Dockerfile 最佳实践

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "main.py"]
```

## Docker Compose

```yaml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/mydb

  db:
    image: postgres:15
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## 健康检查

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s \\
  CMD curl -f http://localhost:8000/health || exit 1
```""",

    "git-工作流完全指南": """## Git Flow

```
main (生产环境)
  └── develop (开发分支)
        ├── feature-xxx
        ├── feature-yyy
        └── release-1.0
```

## 常用命令

### 创建特性分支
```bash
git checkout -b feature/new-feature develop
```

### 合并分支
```bash
git checkout develop
git merge --no-ff feature/new-feature
git branch -d feature/new-feature
```

## Rebase vs Merge

**Merge**:
- 保留完整历史
- 可能产生很多合并提交

**Rebase**:
- 历史更线性
- 不要 rebase 公共分支！

## 常见问题

### 撤销最后一次提交
```bash
git reset --soft HEAD~1
```""",

    "tailwindcss-实用技巧": """## 响应式设计

```html
<div class="text-sm md:text-lg lg:text-xl">
  响应式文本
</div>
```

## 深色模式

```html
<div class="bg-white dark:bg-gray-900">
  <h1 class="text-black dark:text-white">标题</h1>
</div>
```

## 自定义配置

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          500: '#3b82f6',
          600: '#2563eb',
        }
      }
    }
  }
}
```

## 组件化

```jsx
function Button({ variant = 'primary', children }) {
  const variants = {
    primary: 'bg-blue-500 text-white',
    secondary: 'bg-gray-200 text-gray-800',
  };

  return (
    <button className={`px-4 py-2 rounded ${variants[variant]}`}>
      {children}
    </button>
  );
}
```""",

    "程序员健康生活指南": """## 久坐危害

程序员每天坐着敲代码的时间可能超过 8 小时，这对身体危害很大。

## 解决方案

### 1. 定时休息
- 使用 20-20-20 法则：每 20 分钟，看 20 英尺外的物体 20 秒

### 2. 站立办公
考虑使用升降桌，交替站立和坐着工作

### 3. 简单运动

```python
# 每小时做一组简单拉伸
stretches = [
    "颈部旋转",
    "肩部耸动",
    "手腕伸展",
    "躯干扭转"
]
```

## 视力保护

1. 调节显示器亮度与环境光匹配
2. 使用护眼模式
3. 保持屏幕与眼睛至少 50cm 距离

## 心理健康

- 保持社交，不要孤立
- 培养工作之外的兴趣爱好
- 学会说"不"，管理预期""",

    "高效工作的时间管理": """## 番茄工作法

🍅 工作 25 分钟
☕ 休息 5 分钟
🍅 工作 25 分钟
☕ 休息 5 分钟
🍅🍅🍅🍅
🛷 长休息 15-30 分钟

## 优先级矩阵

| | 紧急 | 不紧急 |
|---|---|---|
| **重要** | 立即做 | 计划做 |
| **不重要** | 委托做 | 删除做 |

## 减少切换成本

- 批量处理相似任务
- 使用快捷键减少鼠标操作
- 自动化重复性工作

## 代码示例：待办事项

```python
from dataclasses import dataclass
from enum import Enum
from datetime import datetime

class Priority(Enum):
    HIGH = 1
    MEDIUM = 2
    LOW = 3

@dataclass
class TodoItem:
    title: str
    priority: Priority
    due_date: datetime
```""",

    "命令行工具效率提升": """## Zsh 配置

```bash
# .zshrc
alias gs="git status"
alias gc="git commit"
alias gp="git push"

# 自动补全
autoload -Uz compinit
compinit
```

## tmux 会话管理

```bash
# 创建新会话
tmux new -s work

# 分离会话
Ctrl-b d

# 恢复会话
tmux attach -t work
```

## 快捷操作

```bash
# 历史命令搜索
Ctrl-r

# 命令行编辑
Ctrl-a  # 行首
Ctrl-e  # 行尾
Ctrl-u  # 删除整行

# 目录导航
cd -    # 返回上一个目录
pushd /path  # 入栈
popd       # 出栈
```

## 实用工具

- **fzf**: 模糊文件搜索
- **ripgrep**: 快速代码搜索
- **fd**: 快速文件查找"""
}


def main():
    conn = sqlite3.connect('/Users/ahern/code/projects/meblog/backend/meblog.db')
    cursor = conn.cursor()
    
    for slug, content in posts_content.items():
        cursor.execute('UPDATE posts SET content = ? WHERE slug = ?', (content, slug))
        print(f'Fixed: {slug}')
    
    conn.commit()
    conn.close()
    print('\nAll posts fixed!')


if __name__ == '__main__':
    main()
