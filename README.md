# CodeMentor-AI 🚀

An AI-powered online coding platform that allows developers and students to write, compile, and execute code directly from the browser.

CodeMentor-AI provides a browser-based coding environment with backend APIs, MongoDB persistence, and Docker-isolated code execution for multiple programming languages.

## ✨ Features

* 🧑‍💻 Online code editor
* ▶️ Execute code directly from the browser
* 🐍 Python execution
* ⚡ C++ execution
* ☕ Java execution
* 🐳 Docker-based isolated code execution
* 🔐 User authentication
* 💾 Save and manage programs
* 🗄️ MongoDB database integration
* 🚦 API rate limiting
* 📡 REST API backend
* 📦 Docker support for development
* 🧪 Postman API collection included

## 🏗️ Architecture

```text
┌─────────────────────────┐
│       Frontend          │
│      index.html         │
└────────────┬────────────┘
             │
             │ HTTP / REST API
             ▼
┌─────────────────────────┐
│       Node.js API       │
│       Express.js        │
│        Port 5000        │
└───────┬─────────┬───────┘
        │         │
        │         │ Docker
        │         ▼
        │   ┌───────────────┐
        │   │ Code Executor │
        │   │ Python/C++/   │
        │   │ Java          │
        │   └───────────────┘
        │
        ▼
┌─────────────────────────┐
│        MongoDB          │
│     online_compiler     │
└─────────────────────────┘
```

## 🛠️ Tech Stack

### Frontend

* HTML
* CSS
* JavaScript

### Backend

* Node.js
* Express.js
* Mongoose
* REST APIs

### Database

* MongoDB

### Code Execution

* Docker
* Python
* C++
* Java

### Development Tools

* Git
* GitHub
* Docker Desktop
* Postman

## 📁 Project Structure

```text
CodeMentor-AI/
│
├── CodeMentor-AI-Fixed/
│   │
│   ├── index.html
│   │
│   ├── .hintrc
│   │
│   ├── package-lock.json
│   │
│   └── backend/
│       │
│       ├── package.json
│       ├── package-lock.json
│       ├── .env.example
│       ├── .dockerignore
│       ├── .gitignore
│       ├── Dockerfile
│       ├── docker-compose.yml
│       │
│       ├── docker/
│       │   ├── python/
│       │   │   └── Dockerfile
│       │   ├── cpp/
│       │   │   └── Dockerfile
│       │   ├── java/
│       │   │   └── Dockerfile
│       │   └── build-images.sh
│       │
│       └── src/
│           ├── config/
│           │   └── database.js
│           │
│           ├── controllers/
│           │   ├── authController.js
│           │   ├── compilerController.js
│           │   └── programController.js
│           │
│           ├── middleware/
│           │   ├── authMiddleware.js
│           │   ├── errorMiddleware.js
│           │   └── rateLimiter.js
│           │
│           ├── models/
│           │   ├── Program.js
│           │   └── User.js
│           │
│           ├── routes/
│           │   ├── authRoutes.js
│           │   ├── compilerRoutes.js
│           │   └── programRoutes.js
│           │
│           ├── services/
│           │   └── dockerExecutor.js
│           │
│           └── server.js
│
└── README.md
```

## ⚙️ Requirements

Before running the project, install:

* Node.js
* npm
* Docker Desktop
* Git

MongoDB can be run locally through Docker, so a native MongoDB installation is not required.

## 🚀 Installation

### 1. Clone the repository

```bash
git clone https://github.com/apoorv965/CodeMentor-AI.git
cd CodeMentor-AI
```

Then enter the project directory:

```bash
cd CodeMentor-AI-Fixed
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Configure environment variables

Create a `.env` file from the provided example:

```bash
copy .env.example .env
```

On Linux/macOS:

```bash
cp .env.example .env
```

Update the values inside `.env` according to your environment.

> Never commit your real `.env` file or API keys to GitHub.

## 🐳 Start MongoDB with Docker

Make sure Docker Desktop is running.

Start MongoDB:

```bash
docker run -d \
  --name codementor-mongodb \
  -p 27017:27017 \
  -v codementor-mongo-data:/data/db \
  mongo:7
```

Verify the container:

```bash
docker ps
```

Test MongoDB:

```bash
docker exec codementor-mongodb mongosh --eval "db.runCommand({ ping: 1 })"
```

Expected result:

```text
{ ok: 1 }
```

## 🐳 Build Code Execution Images

CodeMentor-AI uses separate Docker images for each supported programming language.

### Python

```bash
docker build \
  -t online-compiler-python:latest \
  -f backend/docker/python/Dockerfile \
  backend/docker/python
```

### C++

```bash
docker build \
  -t online-compiler-cpp:latest \
  -f backend/docker/cpp/Dockerfile \
  backend/docker/cpp
```

### Java

```bash
docker build \
  -t online-compiler-java:latest \
  -f backend/docker/java/Dockerfile \
  backend/docker/java
```

Verify the images:

```bash
docker images
```

You should see:

```text
online-compiler-python
online-compiler-cpp
online-compiler-java
```

## ▶️ Start the Backend

From the `backend` directory:

```bash
npm start
```

The server should start on:

```text
http://localhost:5000
```

Expected output:

```text
Server running in development mode on port 5000
[DB] MongoDB connected: 127.0.0.1/online_compiler
```

## 🌐 Run the Frontend

The frontend is provided through `index.html`.

From the project root, you can serve it using Python:

```bash
python -m http.server 5500
```

Then open:

```text
http://localhost:5500
```

The application communicates with the backend running on port `5000`.

## 🔌 API

The backend provides REST APIs for:

### Authentication

```text
/api/auth
```

Handles user registration, authentication, and authorization.

### Compiler

```text
/api/compiler
```

Handles code execution through Docker containers.

### Programs

```text
/api/programs
```

Handles saving and managing user programs.

A Postman collection is included in:

```text
backend/postman_collection.json
```

You can import this file into Postman to test the API.

## 💻 Supported Languages

| Language | Docker Image             |
| -------- | ------------------------ |
| Python   | `online-compiler-python` |
| C++      | `online-compiler-cpp`    |
| Java     | `online-compiler-java`   |

## 🔒 Security

Code execution is isolated using Docker containers.

The project also includes:

* Authentication middleware
* Rate limiting
* Environment variable configuration
* Docker-based execution isolation
* Separate execution environments for each language

For production deployment, additional security hardening should be applied, including resource limits, network restrictions, container security policies, and stricter input validation.

## 🧪 Testing

API endpoints can be tested using the included Postman collection:

```text
backend/postman_collection.json
```

You can also test the compiler by submitting simple programs.

### Python

```python
print("Hello, CodeMentor!")
```

### C++

```cpp
#include <iostream>

int main() {
    std::cout << "Hello, CodeMentor!";
    return 0;
}
```

### Java

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, CodeMentor!");
    }
}
```

## 🐳 Docker Services

The project contains Docker configuration for:

* MongoDB
* Python execution
* C++ execution
* Java execution
* Backend containerization

Dockerfiles are located inside:

```text
backend/docker/
```

## 🛑 Stop MongoDB

To stop the MongoDB container:

```bash
docker stop codementor-mongodb
```

To start it again:

```bash
docker start codementor-mongodb
```

To remove the container:

```bash
docker rm codementor-mongodb
```

The named Docker volume keeps MongoDB data persistent:

```text
codementor-mongo-data
```

## 🔐 Environment Variables

Create your own `.env` file based on:

```text
backend/.env.example
```

Never commit secrets such as:

* Database passwords
* JWT secrets
* API keys
* AI provider credentials
* Production credentials

The repository's `.gitignore` is configured to prevent `.env` files from being committed.

## 🤝 Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a feature branch.

```bash
git checkout -b feature/my-feature
```

3. Make your changes.
4. Commit your changes.

```bash
git commit -m "Add my feature"
```

5. Push the branch.

```bash
git push origin feature/my-feature
```

6. Open a Pull Request.

## 📌 Current Development Status

| Component          | Status        |
| ------------------ | ------------- |
| Frontend           | ✅ Working     |
| Node.js Backend    | ✅ Working     |
| MongoDB            | ✅ Docker      |
| Python Execution   | ✅ Docker      |
| C++ Execution      | ✅ Docker      |
| Java Execution     | ✅ Docker      |
| Authentication     | ✅ Implemented |
| Program Management | ✅ Implemented |
| REST API           | ✅ Implemented |

## 📜 License

This project is currently provided for educational and development purposes.

Add an appropriate open-source license if you plan to distribute or modify the project under a specific license.

## 👨‍💻 Author

**Apoorv Shukla**

GitHub: [@apoorv965](https://github.com/apoorv965)

## ⭐ Support

If you find CodeMentor-AI useful, consider giving the repository a ⭐ on GitHub.

Repository:

https://github.com/apoorv965/CodeMentor-AI


## Production-minded local workflow

The repaired build defaults to `PERSISTENCE_MODE=memory` and `EXECUTION_MODE=auto`, so the complete workspace is usable without MongoDB or Docker. Set `PERSISTENCE_MODE=mongo` for production persistence and configure `MONGO_URI`; when Docker is available, `EXECUTION_MODE=auto` automatically selects the isolated executor.

Start the integrated workspace with:

```bash
# terminal 1
cd backend && PERSISTENCE_MODE=memory EXECUTION_MODE=local JWT_SECRET=dev-secret PORT=5000 npm start
# terminal 2
cd frontend && BACKEND_URL=http://127.0.0.1:5000 npm start
```

The frontend is served at `http://localhost:5500`, proxies `/api/*` to the backend, and exposes `/health` plus `/api/capabilities` for operational checks.


## GitHub + Render deployment

The repository is now prepared for a production-style GitHub workflow and a two-service Render deployment. The checked-in [`render.yaml`](render.yaml) defines an API service named `codementor-api` and a frontend workspace named `codementor-web`. Render should be connected to the repository root, not to either subdirectory.

### 1. Push the project to GitHub

From the repository root:

```bash
git init
git branch -M main
git add .
git commit -m "Prepare CodeMentor AI for Render deployment"
git remote add origin https://github.com/<your-account>/<your-repository>.git
git push -u origin main
```

Do not commit `.env` files, MongoDB credentials, JWT secrets, or Gemini keys. The repository ignore rules exclude local secrets and dependency directories. GitHub Actions runs backend and frontend syntax checks on every push and pull request.

### 2. Create the database

Create a MongoDB Atlas cluster before deploying the API. Add a database user, allow the Render service IP policy required by your Atlas plan, and copy the SRV connection string. The database is required in production because the Render Blueprint sets `PERSISTENCE_MODE=mongo`.

### 3. Deploy the Render Blueprint

In Render, choose **New → Blueprint**, connect the GitHub repository, and select the branch containing `render.yaml`. Render will create both services:

| Service | Purpose | Health check |
| --- | --- | --- |
| `codementor-api` | Express API, auth, progress, analytics, mentor endpoints | `/health` |
| `codementor-web` | Frontend workspace and HTTPS API proxy | `/` |

When Render prompts for unsynced values, provide:

| Variable | Service | Required value |
| --- | --- | --- |
| `MONGO_URI` | `codementor-api` | MongoDB Atlas SRV URI |
| `GEMINI_API_KEY` | `codementor-api` | Optional Google AI Studio key for richer mentor responses |

The Blueprint generates `JWT_SECRET` automatically. Never replace it with a value committed to GitHub.

### 4. Verify the deployment

After both services finish deploying, verify:

```bash
curl -fsS https://codementor-api.onrender.com/health
curl -fsS https://codementor-api.onrender.com/api/capabilities
curl -fsS https://codementor-web.onrender.com/
```

Expected API health includes `status: "ok"`, `persistence: "mongo"`, and `analytics: true`. The frontend service proxies `/api/*` requests to the API service over HTTPS, so browser requests do not need a hardcoded local port.

If you use a custom frontend domain, update `CORS_ORIGIN` on `codementor-api` to that exact HTTPS origin. If you rename either Render service, update `BACKEND_URL` in the frontend service and the matching CORS value in the API service.

### Execution security note

Render native Node services do not provide Docker-in-Docker by default. The Blueprint therefore sets `EXECUTION_MODE=disabled` rather than silently running learner code unsandboxed on a public host. Authentication, problem browsing, progress tracking, analytics, saved programs, and mentor flows remain deployable. To enable code execution, deploy the executor on an isolated Docker-capable service and set the execution integration explicitly; do not enable `ALLOW_UNSANDBOXED_EXECUTION=true` on a public production service.

For trusted local development only:

```bash
cd backend
PERSISTENCE_MODE=memory EXECUTION_MODE=local ALLOW_UNSANDBOXED_EXECUTION=true JWT_SECRET=dev-secret npm start
```

### Seed the production problem catalog

After MongoDB is available, run the idempotent seed command once from a trusted environment with the production `MONGO_URI`:

```bash
cd backend
NODE_ENV=production PERSISTENCE_MODE=mongo MONGO_URI="<atlas-uri>" npm run seed
```

The seed command upserts the 956-problem catalog and writes its migration report to `backend/src/seed/migration-report.json`. Do not run this command on every web-service boot; it is an administrative migration, not a startup hook.

### Production readiness checklist

- [ ] GitHub repository contains `render.yaml`, `.github/workflows/ci.yml`, and both npm lockfiles.
- [ ] MongoDB Atlas URI is configured only in Render, never in GitHub.
- [ ] `JWT_SECRET` is generated by Render or stored as a protected secret.
- [ ] `CORS_ORIGIN` matches the exact frontend HTTPS origin.
- [ ] `/health` and `/api/capabilities` return successfully.
- [ ] The 956 problems are seeded into MongoDB.
- [ ] Docker-backed execution is deployed separately before enabling code execution.
- [ ] A custom domain is added only after the default Render URLs work.
