# Sandbox Security & Untrusted Code Execution Architecture

This document details the security model, sandbox guarantees, rate limiting, and network segmentation implemented across the platform to safely execute untrusted user code and handle public traffic.

---

## 1. Sandbox Isolation Guarantees (Judge0 / Isolate)

Untrusted user code is compiled and executed inside isolated Linux sandbox containers powered by `isolate` and Judge0 CE:

| Security Domain | Sandbox Setting | Specification / Guarantee |
| :--- | :--- | :--- |
| **Network Access** | `ENABLE_NETWORK=false` | Complete network isolation. Execution containers have **no network interfaces** (except loopback), blocking outbound TCP/UDP, DNS lookups, botnet command-and-control, reverse shells, and internal network scans. |
| **User Privileges** | `RUN_AS_ROOT=false` | Code runs under dedicated unprivileged sandbox user IDs (e.g. `uid 1000-1999`). Setuid binaries, root privilege escalation, and raw socket creation are blocked by Linux capabilities (`cap_drop: ALL`). |
| **CPU Time Limit** | `CPU_TIME_LIMIT=2.0s` / `MAX_CPU_TIME_LIMIT=15.0s` | Hard CPU timer enforced via Linux cgroups. Busy loops and crypto-miners are killed immediately with `SIGXCPU` / `Time Limit Exceeded`. |
| **Wall-Clock Timeout** | `WALL_TIME_LIMIT=5.0s` / `MAX_WALL_TIME_LIMIT=20.0s` | Hard wall-clock alarm timer prevents indefinite sleeping (`sleep()`), deadlock hanging, or slow I/O attacks. |
| **Memory Limit** | `MEMORY_LIMIT=256MB` / `MAX_MEMORY_LIMIT=512MB` | Enforced via cgroups `memory.limit_in_bytes`. Memory allocation attacks (e.g. heap bombs, huge array allocations) terminate with `SIGSEGV` / `Runtime Error (Out of Memory)`. |
| **Stack Size Limit** | `MAX_STACK_LIMIT=128MB` | Caps stack recursion to prevent kernel panics and stack overflow exploits. |
| **Process & Thread Cap**| `MAX_MAX_PROCESSES_AND_OR_THREADS=60` | Enforced via `pids.max` cgroup controller. Prevents fork bombs (`:(){ :\|:& };:`) and resource exhaustion. |
| **File Output Limit** | `MAX_FILE_SIZE_LIMIT=4MB` | Output disk writes (stdout, stderr, created files) are capped at 4MB to prevent disk saturation attacks. |

---

## 2. Docker Network Architecture & Multi-Tier Isolation

The container architecture strictly isolates untrusted execution from public traffic and databases:

```
[Public Internet / Browsers]
           │
           ▼
┌────────────────────────────────────────┐
│ public_frontend_net (Bridge)           │
│   ├── Frontend Container (Nginx)       │
│   └── Backend Container (FastAPI:8000) │
└────────────────────────────────────────┘
           │
     ┌─────┴─────────────────────────────┐
     │                                   │
     ▼                                   ▼
┌──────────────────────────┐    ┌──────────────────────────────────────────────┐
│ backend_db_net (Bridge)  │    │ judge0_sandbox_net (INTERNAL Bridge)         │
│   ├── Backend Container  │    │   ├── Backend Container                      │
│   └── Postgres Container │    │   └── Judge0 Sandbox Container (Port 2358)   │
│                          │    │                                              │
│ (Isolated DB network)    │    │ (NO external routing, NO frontend visibility,│
└──────────────────────────┘    │  NO host port mapping)                       │
                                └──────────────────────────────────────────────┘
```

- **Judge0 Execution Network**:
  - `judge0_sandbox_net` has `internal: true`, prohibiting any default gateway routing to the internet or external subnets.
  - Judge0 container uses `expose: ["2358"]` with **no host port publishing**.
  - Frontend containers cannot resolve or route packets to Judge0.

---

## 3. Rate Limiting Policy

- **Rate Limit**: **10 requests per minute** enforced on:
  - `POST /run` (and `/api/run`)
  - `POST /submissions` (and `/api/submissions`)
  - `POST /contests/{id}/submit` (and `/api/contests/{id}/submit`)
- **Key Strategy**:
  - Authenticated Users: Keyed by JWT Subject `user:<user_id>`.
  - Guest/Anonymous Traffic: Keyed by Client IP `ip:<client_ip>`.
- **Response**: HTTP 429 Too Many Requests with JSON payload and standard `Retry-After` header.

---

## 4. Input Validation Matrix

All input payloads are validated by Pydantic models before reaching execution pipelines:

| Input Field | Constraint | Rejection Behavior |
| :--- | :--- | :--- |
| **Source Code Length** | `1 <= length <= 20,000` characters | `400 Bad Request` with exact character count error |
| **Language Whitelist** | Whitelist: `python`, `c`, `cpp`, `java` | `400 Bad Request` listing valid supported languages |
| **Standard Input (stdin)** | `0 <= length <= 10,000` characters | `400 Bad Request` |
| **Problem ID** | `Integer > 0` | `400 Bad Request` |
| **Test Case Payload** | `max_length <= 50,000` characters | `400 Bad Request` |

---

## 5. Structured JSON Request & Abuse Monitoring Logging

Every execution and submission request emits a single-line JSON log to stdout for real-time SIEM/monitoring ingestion:

```json
{
  "timestamp": "2026-10-10T09:18:24.512340Z",
  "event": "code_run",
  "endpoint": "/run",
  "user_id": 1,
  "username": "Hit",
  "client_ip": "127.0.0.1",
  "language": "python",
  "code_length": 184,
  "stdin_length": 0,
  "status_code": 200,
  "duration_ms": 142.3,
  "outcome": {
    "stage": "success",
    "status": "Accepted",
    "status_id": 3,
    "execution_time": 0.038,
    "memory": 7240,
    "error": null
  },
  "abuse_flag": false
}
```

- **Abuse Signals**: Automatically flagged (`"abuse_flag": true`, logged as `WARNING`) on:
  - Rate limit violations (`429`)
  - Execution timeouts / SIGXCPU (`status_id: 5`, `504`)
  - Segmentation faults / SIGSEGV (`status_id: 7-13`)
  - Rapid repeated validation rejections (`400`)
