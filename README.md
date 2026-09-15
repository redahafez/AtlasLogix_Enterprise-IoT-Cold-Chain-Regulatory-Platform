# AtlasLogix — Senior Full-Stack Assessment

AtlasLogix is a multi-tenant cold-chain logistics compliance and real-time telemetry platform designed to monitor temperature-sensitive pharmaceuticals and medical cargo.

---

## 🏛️ System Architecture

```
                                  +-----------------------+
                                  |  Browser / Client UI  |
                                  +-----------+-----------+
                                              |
                                     http://localhost:8080
                                              |
                                              v
                                  +-----------+-----------+
                                  |     Nginx Gateway     |
                                  |      (Port 8080)      |
                                  +-----+-----------+-----+
                                        |           |
                 / (UI Routes)          |           | /api/v1 & /ws/v1
                                        v           v
                          +-------------+--+    +---+--------------+
                          | Next.js Frontend|    | Django / Channels|
                          |   (Port 3000)  |    |   (Port 8000)    |
                          +----------------+    +---+-------+------+
                                                            |
                                        +-------------------+-------------------+
                                        |                                       |
                                        v                                       v
                             +----------+----------+               +------------+-----------+
                             | PostgreSQL 16 DB    |               |  Redis 7 Pub/Sub Cache   |
                             | (Persistent Models) |               |  (Channel Layer & Stream) |
                             +---------------------+               +------------------------+
```

### Technical Stack & Supported Versions
- **Edge Reverse Proxy**: Nginx 1.27 (`http://localhost:8080`)
- **Backend API & WebSockets**: Python 3.12, Django 5.1, Django REST Framework 3.15, Django Channels 4.1, Daphne 4.1
- **Frontend SPA / SSR**: Next.js 14.2 (App Router), TypeScript 5.5, React 18.3, Vanilla CSS (AtlasLogix Design Tokens)
- **Database**: PostgreSQL 16-alpine (Persistent tenant data, shipments, audit trail)
- **Cache & Real-time Layer**: Redis 7-alpine (Channels Pub/Sub layer, Stream Tickets)
- **Containerization**: Docker 26+ and Docker Compose 3.8

---

## 🚀 Quick Start (Clean Checkout)

### 1. Prerequisites
- Docker Engine 24.0+ and Docker Compose v2+
- Git

### 2. Environment Setup
Copy the safe template `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Build & Start the Complete Stack
Run a single command to build and launch all containers:
```bash
docker compose up --build
```
This automatically initializes PostgreSQL, Redis, runs Django DB migrations, executes the **idempotent seed import**, compiles the Next.js production bundle, and starts the Nginx reverse proxy gateway at `http://localhost:8080`.

---

## 🔑 Seed User Accounts & Credentials

| Role | Email | Password | Primary Tenant |
| :--- | :--- | :--- | :--- |
| **Compliance Auditor** | `auditor.reda-hafez@atlaslogix.test` | `4wLJerbLyBGBGZG8t8IIjA` | `TENANT-REDA-HAFEZ` |
| **Tenant Administrator** | `admin.reda-hafez@atlaslogix.test` | `7P1OhjscS32sQjYWFCra2w` | `TENANT-REDA-HAFEZ` |
| **Operations Manager** | `operations.reda-hafez@atlaslogix.test` | `eaeGnGIcL8Y7JvaxOHAylw` | `TENANT-REDA-HAFEZ` |
| **Warehouse Supervisor** | `warehouse.reda-hafez@atlaslogix.test` | `X3mJ_Ii5pWcdMNEiLma9ow` | `TENANT-REDA-HAFEZ` |
| **Viewer** | `viewer.reda-hafez@atlaslogix.test` | `DTp6ZNQR7o4_j9l7201uGA` | `TENANT-REDA-HAFEZ` |

---

## 🌐 Public Endpoints (`http://localhost:8080`)

- **Web Application UI**: `http://localhost:8080/login` & `http://localhost:8080/shipments`
- **OpenAPI Swagger Specs**: `http://localhost:8080/api/docs/`
- **Liveness Check**: `GET http://localhost:8080/health/live` (Returns `200 OK`)
- **Readiness Check**: `GET http://localhost:8080/health/ready` (Verifies Postgres & Redis, returns `503` if unavailable)
- **WebSocket Sensor Telemetry**: `ws://localhost:8080/ws/v1/sensor-data?ticket=<stream-ticket>`

---

## 🧪 Testing Suites

### 1. Backend Automated Tests (Django)
```bash
cd backend
python manage.py test core.tests
```
*Covers authentication, RBAC matrix, cross-tenant 404 isolation, concurrent approval locking (`select_for_update`), telemetry replay idempotency, and stream tickets.*

### 2. End-to-End & Accessibility Tests (Playwright & Axe)
```bash
cd tests_e2e
npm test
```
*Executes full browser flow from login through shipment review and auditor approval, plus automated WCAG 2.1 AA accessibility checks.*

---

## ⚙️ Operational Commands (Restart, Backup, Reset)

### Check Health & Service Logs
```bash
# Verify process liveness & dependency readiness
curl http://localhost:8080/health/live
curl http://localhost:8080/health/ready

# View real-time logs for all components
docker compose logs -f

# View component-specific logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f nginx
```

### Restart Service & Recovery Test
```bash
docker compose restart
```

### Clean Reset (Data Wipe & Fresh Re-seed)
```bash
docker compose down -v
docker compose up --build
```

---

## 🛡️ Security, RBAC & Invariants

1. **Strict Multi-Tenant Isolation**:
   - Queries and WebSocket events are strictly scoped to the active `tenantId`.
   - Accessing a shipment belonging to another tenant returns `404 Not Found` to prevent revealing existence.
2. **Authoritative Compliance Approval & Concurrency Locking**:
   - Only active `COMPLIANCE_AUDITOR` membership with `compliance:approve` permission can approve.
   - Approvable only when shipment is `PENDING` and unlocked. Repeated or concurrent attempts use `select_for_update()` and return `409 CONFLICT`.
   - Sensor excursions and low confidence are evidence for human auditor judgment, not automatic rejection rules.
3. **Telemetry Idempotency & Post-Commit Publication**:
   - `POST /api/v1/telemetry/readings` requires `X-Device-Key` and `Idempotency-Key`.
   - Replayed identical events return `200 {replayed: true}` without duplicating DB rows. Conflicting payloads return `409 EVENT_CONFLICT`.
   - WebSocket events are published via `transaction.on_commit()` only after DB transactions commit.

---

## 🤖 AI Usage Disclosure

AI assistance (Google DeepMind Antigravity AI pair programming agent) was utilized during this assessment for:
1. Generating OpenAPI-compliant DRF serializer stubs and Django Channels ASGI consumer boilerplates.
2. Structuring Vanilla CSS token variables from Figma `design-tokens.json`.

All architectural decisions, security boundaries, tenant isolation logic, concurrency locking, and test assertions were reviewed, verified, and validated for correctness.

