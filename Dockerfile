FROM node:22-bookworm-slim

WORKDIR /app

COPY backend/package*.json ./backend/
RUN npm ci --omit=dev --prefix backend

COPY backend ./backend
COPY frontend ./frontend
COPY render-start.js ./render-start.js

ENV NODE_ENV=production \
    PORT=10000 \
    BACKEND_PORT=5001 \
    PERSISTENCE_MODE=mongo \
    EXECUTION_MODE=disabled \
    ALLOW_UNSANDBOXED_EXECUTION=false

EXPOSE 10000

CMD ["node", "render-start.js"]
