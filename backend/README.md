# Online Multi-Language Compiler — Backend

A secure, production-ready backend for an online compiler supporting **Python**, **Java**, and **C++**. User code runs inside locked-down, network-isolated Docker containers with strict CPU/memory/time limits — never on the host or the API server process itself.

## Tech Stack

| Layer            | Technology                          |
|-------------------|--------------------------------------|
| Runtime            | Node.js 18+ / Express.js            |
| Database           | MongoDB (Mongoose)                  |
| Auth               | JWT + bcrypt password hashing        |
| Sandboxing         | Docker (isolated containers per run) |
| Config             | dotenv                              |
| API testing        | Postman (collection included)        |

## Project Structure

```
backend/
├── src/
│   ├── controllers/
│   │   ├── authController.js       # register, login, logout, profile
│   │   ├── compilerController.js   # POST /api/execute
│   │   └── programController.js    # saved programs + history CRUD
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── compilerRoutes.js
│   │   └── programRoutes.js
│   ├── middleware/
│   │   ├── authMiddleware.js       # protect / optionalAuth (JWT)
│   │   ├── errorMiddleware.js      # 404 + centralized error handler
│   │   └── rateLimiter.js          # general / execute / auth limiters
│   ├── services/
│   │   └── dockerExecutor.js       # sandboxed compile + run logic
│   ├── models/
│   │   ├── User.js
│   │   └── Program.js              # saved programs AND execution history
│   ├── config/
│   │   └── database.js
│   └── server.js
├── docker/
│   ├── python/Dockerfile           # sandbox image for Python 3
│   ├── cpp/Dockerfile              # sandbox image for GCC/G++
│   ├── java/Dockerfile             # sandbox image for OpenJDK 17
│   └── build-images.sh             # builds all three at once
├── Dockerfile                      # backend API server image
├── docker-compose.yml              # mongo + backend
├── postman_collection.json
├── .env.example
├── .dockerignore
├── .gitignore
├── package.json
└── README.md
```

## How code execution works

1. `POST /api/execute` validates the request (language, code length, input length).
2. `dockerExecutor.js` writes the code to a unique temp folder (`main.py` / `main.cpp` / `Main.java`).
3. For compiled languages, it runs the compiler **inside a container** first. A non-zero exit = compilation error, returned immediately.
4. On successful compile (or directly for Python), it runs the program **inside a fresh container**, piping `input` to stdin and capturing stdout/stderr.
5. The container is:
   - `--network none` — **no internet/LAN access**
   - `--memory 128m --memory-swap 128m` — **hard memory cap**
   - `--cpus 0.5` — **CPU cap**
   - `--pids-limit 64` — stops fork-bombs
   - `--cap-drop ALL --security-opt no-new-privileges` — minimal Linux capabilities
   - `--user 1000:1000` — **runs as non-root**
   - Only the job's temp folder is mounted in (`-v hostDir:/box`) — **no host filesystem access**
6. A timer (`EXECUTION_TIMEOUT_MS`, default 10s) **force-kills** the container (`SIGKILL`) if it's still running — this is what stops infinite loops.
7. Output is capped at `MAX_OUTPUT_LENGTH` characters to prevent memory blowups from runaway `print` loops.
8. The temp folder is deleted in a `finally` block — **always**, even on error/timeout.
9. If the caller is authenticated, the run is saved to `Program` (history).

## Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Docker Engine (the daemon must be running — this is what actually sandboxes user code)

## Installation

```bash
git clone <your-repo-url>
cd backend
npm install
cp .env.example .env
# edit .env — at minimum set JWT_SECRET and MONGO_URI
```

## Build the sandbox images

The execution containers are **not** pulled from Docker Hub directly — they're small custom images (non-root user baked in) built from `docker/`:

```bash
chmod +x docker/build-images.sh
./docker/build-images.sh
```

This builds:
- `online-compiler-python:latest`
- `online-compiler-cpp:latest`
- `online-compiler-java:latest`

Re-run this whenever you change a `docker/<lang>/Dockerfile`.

## Running

### Option A — Node directly on the host (simplest for local dev)

Requires Docker Desktop/Engine running locally; the backend calls `docker run` directly via `child_process`.

```bash
npm run dev      # nodemon, auto-restart
# or
npm start
```

Server starts on `http://localhost:5000` (or `PORT` from `.env`).

### Option B — Everything in docker-compose (Mongo + backend)

The backend container talks to the **host's** Docker daemon via a mounted socket (Docker-outside-of-Docker), so it can still launch the Python/C++/Java sandbox containers as siblings.

```bash
./docker/build-images.sh     # build sandbox images on the host first
docker compose up --build
```

> **Note:** `docker-compose.yml` mounts `/var/run/docker.sock` and `/tmp` into the backend container. This lets the backend spawn sibling containers on the host engine, but it does mean the backend container has significant control over the host's Docker daemon — treat it the same as root access. For a hardened production deployment, consider running the backend on a dedicated host with Docker directly (Option A) rather than nesting it in compose, or use a rootless Docker / gVisor runtime for the sandbox images.

## Environment Variables

| Variable                  | Description                                          | Default |
|----------------------------|-------------------------------------------------------|---------|
| `PORT`                     | API server port                                      | `5000` |
| `NODE_ENV`                 | `development` / `production`                          | `development` |
| `MONGO_URI`                 | MongoDB connection string                             | — |
| `JWT_SECRET`                | Secret used to sign JWTs — **change this**             | — |
| `JWT_EXPIRES_IN`            | Token lifetime                                        | `7d` |
| `CORS_ORIGIN`               | Allowed frontend origin                               | `*` |
| `EXECUTION_TIMEOUT_MS`      | Max time before a run is killed                       | `10000` |
| `EXECUTION_MEMORY_LIMIT`    | Container memory cap                                  | `128m` |
| `EXECUTION_CPU_LIMIT`       | Container CPU cap (cores)                             | `0.5` |
| `EXECUTION_PIDS_LIMIT`      | Max processes/threads inside container                | `64` |
| `MAX_CODE_LENGTH`           | Max source code size (chars)                          | `20000` |
| `MAX_INPUT_LENGTH`          | Max stdin size (chars)                                | `5000` |
| `MAX_OUTPUT_LENGTH`         | Max stdout/stderr captured (chars)                     | `20000` |
| `RATE_LIMIT_WINDOW_MS`      | Window for general rate limiting                       | `60000` |
| `RATE_LIMIT_MAX`            | Max requests per window (general)                      | `100` |
| `EXECUTE_RATE_LIMIT_MAX`    | Max `/api/execute` calls per window                    | `10` |
| `DOCKER_PYTHON_IMAGE`       | Sandbox image tag for Python                           | `online-compiler-python:latest` |
| `DOCKER_CPP_IMAGE`          | Sandbox image tag for C++                              | `online-compiler-cpp:latest` |
| `DOCKER_JAVA_IMAGE`         | Sandbox image tag for Java                             | `online-compiler-java:latest` |

## API Documentation

Base URL: `http://localhost:5000`

### Auth

#### `POST /api/auth/register`
```json
// Request
{ "name": "Aman Sharma", "email": "aman@example.com", "password": "secret123" }

// 201 Response
{
  "success": true,
  "token": "eyJhbGciOi...",
  "user": { "id": "665f...", "name": "Aman Sharma", "email": "aman@example.com", "createdAt": "..." }
}
```

#### `POST /api/auth/login`
```json
// Request
{ "email": "aman@example.com", "password": "secret123" }

// 200 Response — same shape as register
```

#### `GET /api/auth/profile`   *(requires `Authorization: Bearer <token>`)*
```json
{ "success": true, "user": { "id": "...", "name": "...", "email": "...", "createdAt": "..." } }
```

#### `POST /api/auth/logout`   *(requires auth)*
```json
{ "success": true, "message": "Logged out successfully. Discard the token on the client." }
```

### Code Execution

#### `POST /api/execute`
Auth optional — send a Bearer token to also save the run to your history.

```json
// Request
{
  "language": "python",
  "code": "name = input()\nprint('Hello, ' + name)",
  "input": "World"
}
```

**Success:**
```json
{ "success": true, "output": "Hello, World\n", "error": null, "executionTime": "142ms" }
```

**Compilation error:**
```json
{ "success": false, "output": "", "error": "main.cpp:2:41: error: expected ';' before '}' token", "executionTime": "310ms" }
```

**Runtime error:**
```json
{ "success": false, "output": "", "error": "Traceback (most recent call last):\n  File \"main.py\", line 1, in <module>\n    print(1/0)\nZeroDivisionError: division by zero", "executionTime": "88ms" }
```

**Timeout (infinite loop):**
```json
{ "success": false, "output": "", "error": "Execution timed out after 10000ms (likely an infinite loop).", "executionTime": "10004ms" }
```

### Programs (saved code + history) — all require auth

| Method | Endpoint                | Description                          |
|--------|---------------------------|----------------------------------------|
| GET    | `/api/programs/history`   | Paginated list of every past execution (`?page=&limit=`) |
| GET    | `/api/programs/saved`     | Programs the user explicitly saved     |
| POST   | `/api/programs`           | Save a new program                     |
| PUT    | `/api/programs/:id`       | Update a saved program                 |
| DELETE | `/api/programs/:id`       | Delete a saved program / history entry |

`POST /api/programs` request body:
```json
{ "title": "Sum of two numbers", "language": "python", "code": "print(sum(map(int, input().split())))", "input": "2 3" }
```

## Postman

Import `postman_collection.json` into Postman. It includes:
- Register / Login (login auto-saves the token into a collection variable)
- Execute in Python / C++ / Java
- A compilation-error example and an infinite-loop/timeout example
- Save / list / update / delete programs
- Health check

Set the `baseUrl` collection variable if you're not running on `localhost:5000`.

## Security Checklist

- ✅ User code never runs on the host process — always inside a throwaway Docker container
- ✅ `--network none` — no outbound network from inside the sandbox
- ✅ Memory, CPU, and process-count limits enforced per run
- ✅ Hard execution timeout (kills infinite loops)
- ✅ Runs as a non-root UID with all Linux capabilities dropped
- ✅ Only a per-job temp folder is mounted in — no access to the rest of the filesystem
- ✅ Temp files deleted immediately after execution (success, failure, or crash)
- ✅ Passwords hashed with bcrypt, never returned in API responses
- ✅ JWT-based auth; tokens expire (`JWT_EXPIRES_IN`)
- ✅ Rate limiting on `/api/execute` (stricter) and globally
- ✅ Request body size and code/input length limits
- ✅ `helmet` for HTTP security headers, `cors` restricted via `CORS_ORIGIN`

## Connecting a React Frontend

```js
// Execute code
const res = await fetch(`${API_BASE}/api/execute`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify({ language: 'python', code, input }),
});
const data = await res.json(); // { success, output, error, executionTime }
```

CORS is controlled by `CORS_ORIGIN` in `.env` — set it to your frontend's origin (e.g. `http://localhost:3000`) in development and your deployed domain in production.

## Troubleshooting

- **`Failed to start Docker container: spawn docker ENOENT`** — Docker isn't installed or not on PATH where Node is running.
- **Every request times out** — check `docker ps` for a stuck daemon, or that the sandbox images were built (`./docker/build-images.sh`).
- **Compose setup can't find images** — sandbox images (`online-compiler-*`) must exist on the **host** Docker engine before starting compose, since the backend container reaches the host daemon via the mounted socket.
- **Mongo connection refused** — confirm `MONGO_URI` matches how you're running Mongo (`localhost:27017` for local, `mongo:27017` under compose).

## License

MIT

## Production deployment note
The backend needs access to a Docker engine because each Python/C++/Java execution starts an isolated container. A static host alone cannot provide this. Deploy the backend on a Docker-capable VM/container host, set `CORS_ORIGIN` to the exact frontend origin, and update the frontend `CODEMENTOR_BACKEND_URL`/`BACKEND_URL` to the public HTTPS backend URL.
