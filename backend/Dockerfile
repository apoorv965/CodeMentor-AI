# Dockerfile for the backend API server itself.
#
# The backend spawns sibling Docker containers (via `docker run`) to
# execute user code, using the host's Docker socket mounted in at
# /var/run/docker.sock (see docker-compose.yml). That means this image
# needs the `docker` CLI installed, even though it never runs a Docker
# *daemon* itself (Docker-outside-of-Docker, not Docker-in-Docker).
FROM node:20-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends docker.io \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 5000

CMD ["node", "src/server.js"]
