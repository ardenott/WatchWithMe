# ---- Build frontend ----
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ---- Production image ----
FROM node:20-alpine AS production
WORKDIR /app

# Install backend dependencies
COPY backend/package.json ./backend/
RUN cd backend && npm install --omit=dev

# Copy backend source
COPY backend/src ./backend/src

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Data volume for SQLite
RUN mkdir -p /data
VOLUME ["/data"]

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "backend/src/index.js"]
