# System Architecture: AI Code Review & Contest Platform

## Overview
This platform combines competitive programming contest capabilities (similar to HackerRank / LeetCode) with AI-assisted code review, static analysis, and intelligent mentoring.

```
                           +------------------------+
                           |   React + Vite Client  |
                           |     (Monaco Editor)    |
                           +-----------+------------+
                                       |
                         REST / JWT    |    CORS
                                       v
                           +------------------------+
                           |   FastAPI Backend API  |
                           +-----+------------+-----+
                                 |            |
                    SQLAlchemy   |            |  Anthropic Claude API
                                 v            v
                      +------------+    +---------------+
                      | PostgreSQL |    | AI Code Review|
                      |  Database  |    |     Engine    |
                      +------------+    +---------------+
                                 |
                                 v (Future)
                      +--------------------+
                      | Execution Service  |
                      |  (Judge0 Sandboxes)|
                      +--------------------+
```

## Core Components
1. **Frontend (`/frontend`)**:
   - Built with React 19, TypeScript, and Vite.
   - Monaco Editor for code writing with syntax highlighting and autocompletion.
   - Authentication flow (signup/login) stored in JWT.
   - Protected interactive contest/review dashboard.

2. **Backend (`/backend`)**:
   - FastAPI high-performance asynchronous API framework.
   - SQLAlchemy ORM with Alembic database schema migrations.
   - Secure authentication with bcrypt password hashing and JWT bearer tokens.
   - AI code review integration via Anthropic Claude API.

3. **Execution Service (`/execution-service`)**:
   - Sandbox executor (Judge0 integration) to securely compile and execute user code against testcases in ephemeral containers.

4. **Database & Infrastructure**:
   - PostgreSQL 16 relational database for users, contests, submissions, testcases, and review reports.
   - Orchestrated via `docker-compose.yml`.
