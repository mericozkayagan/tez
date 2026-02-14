FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json* ./
COPY packages/types/package.json ./packages/types/
COPY packages/crypto/package.json ./packages/crypto/
COPY packages/db/package.json ./packages/db/
COPY packages/mcp-tools/package.json ./packages/mcp-tools/
COPY apps/backend/package.json ./apps/backend/

RUN npm install --workspaces --include-workspace-root

# Copy source
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/backend/ ./apps/backend/

# Build
RUN npm run build --workspace=packages/types
RUN npm run build --workspace=packages/crypto
RUN npm run build --workspace=packages/db
RUN npm run build --workspace=packages/mcp-tools
RUN npm run build --workspace=apps/backend

# ── Production ──
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/package.json ./apps/backend/

EXPOSE 3001

CMD ["node", "apps/backend/dist/server.js"]
