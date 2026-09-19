# Dentara — AI-Assisted Clinic CRM

Dentara extends an existing Astro dental-clinic website with a secure, multi-user staff CRM backed by Python and FastAPI. It includes patient records, appointment scheduling with overlap detection, role-based workflows, a daily dashboard, and privacy-conscious clinical-note summarisation.

## Live deployment

- **Clinic website:** [ai-assisted-clinic.vercel.app](https://ai-assisted-clinic.vercel.app/)
- **Staff CRM:** [ai-assisted-clinic.vercel.app/staff](https://ai-assisted-clinic.vercel.app/staff/)
- **API health:** [ai-assisted-clinic.vercel.app/api/health](https://ai-assisted-clinic.vercel.app/api/health)

On the hosted staff page, choose **Front desk** or **Doctor** under “Try the live demo” for instant role-based access.

## Product tour

- **Public clinic site:** responsive marketing pages, services, team, contact and booking demo.
- **Staff dashboard:** today’s visits, checked-in patients, completions and patient totals.
- **Patient CRM:** searchable demographic, contact, allergy and medical-history records.
- **Conflict-safe scheduling:** the API rejects overlapping appointments for the same doctor with HTTP `409 Conflict` and identifies the conflicting visit.
- **Two roles:** front desk manages patients and clinic scheduling; doctors see their own schedule and manage clinical notes.
- **AI-assisted notes:** doctors can turn long notes into a concise extractive summary. It runs locally and does not disclose protected health information to an external model.

## Stack

- Frontend: Astro 5, TypeScript, custom responsive CSS
- Backend: FastAPI, SQLAlchemy 2, Pydantic, JWT
- Database: SQLite locally (set `DATABASE_URL` for a managed SQL database in production)
- Tests: Pytest + FastAPI TestClient
- Hosting: Cloudflare Pages (frontend) and Render/Railway/Fly.io (API)

## Run locally

### 1. API

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill SECRET_KEY and DEMO_PASSWORD with unique values before continuing.
uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`; interactive docs are at `http://localhost:8000/docs`.

### 2. Frontend

```bash
corepack enable
pnpm install
pnpm dev
```

Open `http://localhost:4321/staff`. The default API URL is `http://localhost:8000/api`. For deployment, set `PUBLIC_API_URL=https://your-api.example.com/api` before building.

### Demo users

| Role | Email |
|---|---|
| Front desk | `frontdesk@dentara.test` |
| Doctor | `doctor@dentara.test` |

Both accounts use the private value you set in `DEMO_PASSWORD`. Generate strong values with `python -c "import secrets; print(secrets.token_urlsafe(48))"`; run it separately for the signing key and demo password. Never commit the resulting `.env` file or use this demonstration build with real patient data.

## Test and build

```bash
cd backend && pytest -q
cd .. && pnpm build
```

## API surface

- `POST /api/auth/login`, `GET /api/auth/me`
- `GET/POST/PUT /api/patients`
- `GET/POST/PATCH /api/appointments`
- `POST /api/appointments/{id}/summarize`
- `GET /api/dashboard`, `GET /api/staff/doctors`
- `GET /api/health`

## Security and healthcare note

Passwords are PBKDF2-hashed with per-user salts; access tokens expire; every protected route verifies the token and role; doctor schedule access is scoped to that doctor; clinical notes are doctor-only. This is a portfolio demonstration, not a HIPAA/GDPR-certified product. Production use would additionally require managed secrets, TLS, database migrations, encryption at rest, audit logs, backups, retention policy, consent workflows, MFA, rate limiting, and a signed compliance assessment.

See [BUILD_LOG.md](./BUILD_LOG.md) for decisions, limitations, and the AI Usage Report. See [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) for the 3–5 minute recording outline.
