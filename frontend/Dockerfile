# ==========================
# 构建阶段（极速 pnpm）
# ==========================
FROM docker.m.daocloud.io/library/node:20-alpine AS builder
# 启用国内镜像
RUN npm config set registry https://registry.npmmirror.com
# 构建时环境选择：test / production / 默认 local
ARG NEXT_PUBLIC_ENV=local
ENV NEXT_PUBLIC_ENV=${NEXT_PUBLIC_ENV}
# 核心：启用 corepack 安装 pnpm（比 npm 快 5 倍！）
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
# 依赖缓存
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --registry https://registry.npmmirror.com
# 构建 Next.js
COPY . .
RUN pnpm run build
# ==========================
# 运行阶段（Next standalone）
# ==========================
FROM docker.m.daocloud.io/library/node:20-alpine AS runner
ARG NEXT_PUBLIC_ENV=local
ENV NEXT_PUBLIC_ENV=${NEXT_PUBLIC_ENV}
WORKDIR /app

# 非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# 复制 standalone 运行所需产物
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.next/standalone ./

RUN chown -R nextjs:nodejs /app
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]