# ─── Stage 1: Build Svelte frontend ─────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY package.json package-lock.json* .npmrc ./
RUN npm ci --ignore-scripts 2>/dev/null || npm install --ignore-scripts

COPY frontend/ ./frontend/
RUN npm run build

# ─── Stage 2: Backend runtime ────────────────────────────────────────────────
FROM oven/bun:1-alpine AS backend

# Install network tools: ping, traceroute, dig, openssl
RUN apk add --no-cache \
    iproute2 \
    iputils \
    bind-tools \
    traceroute \
    openssl \
    iperf3

WORKDIR /app

# Install backend dependencies (only production deps)
COPY package.json .npmrc ./
RUN bun install --production

# Copy backend source
COPY backend/src ./backend/src
COPY backend/tsconfig.json ./backend/

# Copy built frontend (backend serves ./public relative to cwd /app)
COPY --from=frontend-builder /app/backend/public ./public

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3201

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost:${PORT:-3201}/api/status > /dev/null || exit 1

CMD ["bun", "run", "backend/src/index.ts"]
