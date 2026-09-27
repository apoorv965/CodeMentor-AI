FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 g++ default-jdk \
    && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./backend/
RUN npm ci --omit=dev --prefix backend

COPY backend ./backend
COPY frontend ./frontend
COPY render-start.js ./render-start.js

ENV NODE_ENV=production \
    PORT=10000 \
    BACKEND_PORT=5001 \
    PERSISTENCE_MODE=mongo \
    EXECUTION_MODE=local \
    ALLOW_UNSANDBOXED_EXECUTION=true

EXPOSE 10000

CMD ["node", "render-start.js"]
