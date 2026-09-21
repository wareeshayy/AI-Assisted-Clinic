# 3–5 Minute Demo Script

## 0:00–0:35 — Context

Open the Dentara public homepage, briefly show the services and booking experience, then open `/staff`. Explain that Dentara combines a patient-facing clinic website with an operational CRM powered by FastAPI.

## 0:35–1:30 — Front-desk workflow

Sign in as `frontdesk@dentara.test`. Show today’s dashboard metrics and schedule. Open Patients, search for “Maya,” and point out contact, allergy and medical-history fields. Add a sample patient.

## 1:30–2:25 — Scheduling and conflicts

Create an appointment for the new patient. Then try another appointment for the same doctor whose time overlaps. Show the human-readable conflict message and explain the interval rule is enforced in the API, not only in the browser.

## 2:25–3:35 — Doctor role and AI assist

Sign out and use `doctor@dentara.test`. Note that patient creation is gone and the schedule is restricted to this doctor. Open the sparkle action on an appointment, enter a short note with symptoms, finding, treatment and follow-up, and generate a summary. Point out the privacy label and explain that this demo uses a local deterministic summariser so patient content never leaves the server.

## 3:35–4:15 — Engineering close

Show `/docs` on the FastAPI service and briefly mention JWT authentication, hashed passwords, SQLAlchemy models, role guards, HTTP 409 conflict handling and tests. Close with the README’s production caveats: PostgreSQL, migrations, audit logs, encryption, MFA and formal compliance review.
