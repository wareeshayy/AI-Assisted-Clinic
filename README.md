# Dentara — AI-Assisted Clinic CRM

Dentara is a full-stack dental-clinic platform that combines a responsive public website with a secure, multi-user staff CRM. The application provides patient-record management, conflict-safe appointment scheduling, role-based staff workflows, operational dashboards, and privacy-conscious AI-assisted clinical-note summarisation. Its Astro frontend and Python FastAPI backend are deployed together as one integrated application.

## Live deployment

- **Clinic website:** [ai-assisted-clinic.vercel.app](https://ai-assisted-clinic.vercel.app/)
- **Staff CRM:** [ai-assisted-clinic.vercel.app/staff](https://ai-assisted-clinic.vercel.app/staff/)
- **API health:** [ai-assisted-clinic.vercel.app/api/health](https://ai-assisted-clinic.vercel.app/api/health)
- **Interactive API docs:** [ai-assisted-clinic.vercel.app/docs](https://ai-assisted-clinic.vercel.app/docs)

On the hosted staff page, choose **Front desk** or **Doctor** under “Try the live demo” for instant role-based access.

## Functionality

### Public clinic experience

- Responsive clinic website for desktop, tablet and mobile screens.
- Service, treatment, dentist, clinic-information and contact pages.
- Public appointment-booking experience with patient, service, date and time inputs.
- Clear navigation between the public website, booking flow and protected staff workspace.

### Authentication and role-based access

- JWT-based authentication with expiring access tokens.
- PBKDF2 password hashing with a unique salt for every account.
- Separate **front-desk** and **doctor** roles with server-enforced permissions.
- Hosted one-click demo access for either role without exposing passwords in frontend code.
- Authenticated profile endpoint for restoring and validating staff sessions.

### Staff dashboard

- Daily operational overview showing appointment and patient totals.
- Counts for scheduled, checked-in and completed visits.
- Today’s appointment list for quick clinic coordination.
- Doctor accounts receive a schedule scoped to their own assigned appointments.

### Patient CRM

- Create, view, search and update patient records.
- Store patient names, phone numbers, email addresses and dates of birth.
- Maintain allergy, medical-history and clinical-context information.
- Open an individual patient record together with its appointment history.
- Front-desk access for registration and record maintenance, with authenticated clinical access for doctors.

### Appointment management

- Create appointments by assigning a patient, doctor, service, start time and duration.
- View appointments using date and doctor filters.
- Update appointment status and clinical notes through protected workflows.
- Track scheduled, checked-in, completed and cancelled appointment states.
- Reject overlapping appointments for the same doctor with HTTP `409 Conflict`.
- Return details about the conflicting visit so staff can select another time.

### AI-assisted clinical notes

- Doctors can convert lengthy appointment notes into concise summaries.
- Summarisation is extractive and runs inside the backend without sending patient information to an external AI provider.
- Only authorised doctor workflows can access clinical notes and request summaries.

### API and deployment

- REST API with Pydantic validation and SQLAlchemy persistence.
- Interactive OpenAPI/Swagger documentation at `/docs`.
- Health endpoint at `/api/health` for deployment monitoring.
- Astro frontend and FastAPI serverless backend hosted together on Vercel.
- Automated API tests cover authentication, permissions, scheduling conflicts and note summarisation.

## Stack

- Frontend: Astro 5, TypeScript, custom responsive CSS
- Backend: FastAPI, SQLAlchemy 2, Pydantic, JWT
- Database: SQLite locally (set `DATABASE_URL` for a managed SQL database in production)
- Tests: Pytest + FastAPI TestClient
- Hosting: Vercel (Astro static frontend and FastAPI serverless API)

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

See [BUILD_LOG.md](./BUILD_LOG.md) for decisions, limitations, and the AI Usage Report. See [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) for the 3–5 minute recording outline and [SUBMISSION.md](./SUBMISSION.md) for the deliverables checklist and ready-to-send submission reply.
