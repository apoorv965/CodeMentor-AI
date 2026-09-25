# Running CodeMentor-AI locally (VS Code)

Everything below assumes you opened the `CodeMentor-AI-Fixed` folder in VS Code.

## What you need

| Thing | Why | Check |
|---|---|---|
| Node.js 18+ | backend + frontend server | `node -v` |
| MongoDB (local or Atlas) | users, problems, progress | `mongod --version` |
| Docker Desktop | sandboxed code execution | `docker --version` |
| Gemini API key | Explain / Find bug / Hint | free at https://aistudio.google.com/apikey |

Docker and the Gemini key are only needed for running code and for the mentor.
Without them you can still browse, log in, and see the UI — Run/Submit and the
hint buttons will return a clear error instead of silently failing.

## 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # Windows PowerShell: copy .env.example .env
```

Open `backend/.env` and set at least:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/codementor
JWT_SECRET=any_long_random_string
GEMINI_API_KEY=your_key_here
CORS_ORIGIN=http://localhost:5500,http://127.0.0.1:5500
```

Start MongoDB (skip if you're using Atlas — just paste that URI above), then:

```bash
npm run dev      # nodemon, restarts on save
```

You should see `Server running in development mode on port 5000`.

## 2. Load the problems

One time only, from the `backend` folder:

```bash
npm run seed
```

This upserts every problem into MongoDB. It's safe to re-run.

## 3. Build the execution sandboxes

Only needed for Run/Submit. From the `backend` folder, with Docker Desktop
running:

```bash
bash docker/build-images.sh
```

Windows without bash: run the three `docker build` lines inside that file
manually, or use Git Bash.

## 4. Frontend

Two options, pick either:

**A — the built-in server (no extensions):**

```bash
cd frontend
npm start        # http://localhost:5500
```

**B — VS Code Live Server extension:** right-click `frontend/index.html` →
*Open with Live Server*. Live Server also uses port 5500, so it matches the
CORS setting above.

Don't open `index.html` by double-clicking it. A `file://` page can't talk to
the backend.

## 5. Run it

Open http://localhost:5500, sign up, and you're in.

- **Dashboard** — progress, quick actions, browse by topic
- **Topics** — every tag as a card; click one to get only those problems
- **Practice** — the problem table, with topic chips across the top
- **A problem** — write code, Run, and when it fails press *View hint*

## Debugging in VS Code

`.vscode/launch.json` is included. Press F5 and pick **Run everything** to
start the backend and the frontend server together with breakpoints attached.

## Common problems

**"Could not reach the backend at http://localhost:5000"**
The backend isn't running, or your `.env` has a different `PORT`. If you change
the port, change it in `frontend/index.html` too — search for `localhost:5000`.

**CORS error in the browser console**
Your frontend's origin isn't in `CORS_ORIGIN`. Add it and restart the backend.

**Hint returns "AI mentor is not configured on this server"**
`GEMINI_API_KEY` is empty in `backend/.env`. Add it and restart.

**Run says the judge failed**
Docker Desktop isn't running, or the images aren't built. See step 3.

**No problems in the list**
You skipped step 2. Run `npm run seed`.
