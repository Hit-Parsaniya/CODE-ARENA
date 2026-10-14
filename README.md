# Code Arena — AI-Powered Code Review & Contest Platform Monorepo

> A full-stack competitive programming and automated AI code review platform (reminiscent of HackerRank meets an automated AI Staff Engineer code reviewer).

---

## Architecture & Directory Structure

```text
ai-code-review/
├── frontend/               # React 19 + Vite + TypeScript + Monaco Editor SPA
│   ├── src/
│   │   ├── components/     # Navbar, Dashboard, RubricView, AuthModal
│   │   ├── context/        # AuthContext (JWT management, persistence, health monitor)
│   │   ├── services/       # Typed API client for FastAPI backend
│   │   └── types/          # Auth, User, and Token interfaces
│   ├── .env.example        # Frontend environment template (API_BASE_URL)
│   ├── Dockerfile          # Multi-stage production build (Node build -> Nginx)
│   └── package.json        # Dependencies including @monaco-editor/react & lucide-react
├── backend/                # FastAPI (Python 3.11+) backend service
│   ├── alembic/            # Database migrations directory
│   │   ├── versions/       # 0001_create_users_table.py
│   │   └── env.py          # Dynamic DB URL configuration
│   ├── app/
│   │   ├── api/            # API endpoints: POST /auth/signup, POST /auth/login, GET /auth/me
│   │   ├── core/           # Security (bcrypt, JWT), Config, and Database Session
│   │   ├── models/         # SQLAlchemy User model (id, username, email, password_hash, created_at)
│   │   ├── schemas/        # Pydantic validation schemas
│   │   └── main.py         # App factory, CORS middleware, GET /health endpoint
│   ├── .env.example        # Backend environment template (DB_URL, JWT_SECRET, ANTHROPIC_API_KEY)
│   ├── alembic.ini         # Alembic configuration
│   ├── Dockerfile          # Container definition
│   └── requirements.txt    # FastAPI, SQLAlchemy, Alembic, psycopg2-binary, bcrypt, python-jose
├── execution-service/      # Execution sandbox service (reserved for Judge0 / isolate sandboxes)
├── docs/                   # Architecture notes & evaluation rubrics
│   ├── architecture.md     # Platform architecture & data flow
│   └── rubric.md           # 5-Pillar evaluation rubric (Correctness, Complexity, Style, Security, Maintainability)
├── docker-compose.yml      # Orchestrates Postgres, Backend, and Frontend containers
└── README.md               # Monorepo setup and developer guide
```

---

## Quickstart with Docker Compose

Running the entire stack with Docker Compose starts PostgreSQL, runs database migrations automatically, launches the FastAPI backend, and serves the React frontend.

### 1. Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/) (v2.20+)

### 2. Configure Environment Variables

Create `.env` files from their respective `.env.example` templates:

```bash
# In the root or backend directory:
cp backend/.env.example backend/.env

# In the frontend directory:
cp frontend/.env.example frontend/.env
```

**Key variables in `backend/.env`:**
```env
DB_URL=postgresql+psycopg2://postgres:postgres@postgres:5432/aicode_db
JWT_SECRET=dev_jwt_secret_change_in_production_key_random_32_bytes
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
ANTHROPIC_API_KEY=your_anthropic_api_key_here
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost,http://127.0.0.1:5173,http://127.0.0.1:3000
```

**Key variables in `frontend/.env`:**
```env
API_BASE_URL=http://localhost:8000
VITE_API_BASE_URL=http://localhost:8000
```

### 3. Launch the Stack

Run from the root directory:

```bash
docker-compose up --build
```

To run in detached background mode:
```bash
docker-compose up -d --build
```

### 4. Access the Services

| Service | URL | Notes |
| :--- | :--- | :--- |
| **Frontend Web App** | [http://localhost:5173](http://localhost:5173) or [http://localhost:3000](http://localhost:3000) | React SPA with Monaco Code Editor & Contest Arena |
| **FastAPI Backend** | [http://localhost:8000](http://localhost:8000) | Root API service |
| **Health Check** | [http://localhost:8000/health](http://localhost:8000/health) | Returns `{"status": "ok"}` |
| **Interactive API Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Swagger UI for exploring and testing endpoints |
| **PostgreSQL Database** | `localhost:5432` | User: `postgres`, Pass: `postgres`, DB: `aicode_db` |

To stop all services:
```bash
docker-compose down
```
To remove persistent database volumes as well:
```bash
docker-compose down -v
```

---

## Local Development (Without Docker)

### 1. Database (PostgreSQL)
Ensure you have a PostgreSQL instance running on `localhost:5432`. Create a database named `aicode_db`:
```sql
CREATE DATABASE aicode_db;
```

### 2. Backend Setup

```bash
cd backend

# Create and activate a Python virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start FastAPI development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at `http://localhost:8000` with live reload.

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

The frontend will start at `http://localhost:5173`.

---

## Authentication Endpoints

The backend exposes standard JWT Bearer authentication:

### `POST /auth/signup`
Creates a new user record with bcrypt-hashed passwords.
- **Request Body**:
  ```json
  {
    "username": "codemaster",
    "email": "coder@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response** (HTTP 201):
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
    "token_type": "bearer",
    "user": {
      "id": 1,
      "username": "codemaster",
      "email": "coder@example.com",
      "created_at": "2026-09-26T14:00:00Z"
    }
  }
  ```

### `POST /auth/login`
Authenticates a user via either their username or email.
- **Request Body**:
  ```json
  {
    "username_or_email": "codemaster",
    "password": "SecurePassword123!"
  }
  ```
- **Response** (HTTP 200):
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
    "token_type": "bearer",
    "user": { ... }
  }
  ```

### `GET /auth/me`
Protected endpoint retrieving the profile of the caller using the Bearer token.
- **Headers**: `Authorization: Bearer <access_token>`
- **Response**: User object.

### `GET /health`
- **Response** (HTTP 200):
  ```json
  {
    "status": "ok"
  }
  ```

---

## Database Migrations (Alembic)

To generate a new migration after updating models in `backend/app/models/`:

```bash
cd backend
alembic revision --autogenerate -m "describe_changes"
alembic upgrade head
```

To roll back a migration:
```bash
alembic downgrade -1
```

### Problems and administrator access

Apply the migrations with `alembic upgrade head` before using the Problems module. New accounts are regular users; after signing up the intended administrator, grant access directly in the database:

```sql
UPDATE users SET is_admin = TRUE WHERE username = 'admin-user';
```

Problem reads are public. Creating, editing, and deleting problems or test cases requires an authenticated account with `is_admin = TRUE`. Public problem details and submission results include sample cases only.

---

## CORS Configuration

CORS is dynamically configured in `backend/app/core/config.py` using `CORS_ORIGINS`. Both comma-separated strings (in `.env`) and list formats are automatically parsed. By default, it allows requests from `http://localhost:5173`, `http://localhost:3000`, and `http://127.0.0.1:5173`.

---

## Next Steps: Execution Service

The `/execution-service` directory is scaffolded to integrate [Judge0](https://judge0.com/) or an isolate sandbox engine for sandboxed multi-language code compilation, resource throttling (CPU/RAM limits), and automated test execution against private test suites.
