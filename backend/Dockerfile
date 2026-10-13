FROM docker.m.daocloud.io/library/python:3.12-slim
WORKDIR /app
# 阿里云源
RUN sed -i 's|http://deb.debian.org/debian|https://mirrors.aliyun.com/debian|g' /etc/apt/sources.list.d/debian.sources && \
apt-get update && apt-get install -y --no-install-recommends build-essential libpq-dev curl && \
rm -rf /var/lib/apt/lists/*
# 安装 uv（使用 pip + 清华镜像）
RUN pip install uv --index-url https://pypi.tuna.tsinghua.edu.cn/simple
ENV PATH="/app/.venv/bin:/root/.local/bin:$PATH"

ENV UV_HTTP_TIMEOUT=120
ENV UV_HTTP_RETRIES=5
ENV UV_CACHE_DIR=/root/.cache/uv

# 依赖
COPY pyproject.toml uv.lock ./
RUN  uv sync --frozen --no-dev --index-url https://mirrors.aliyun.com/pypi/simple
# 代码
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]