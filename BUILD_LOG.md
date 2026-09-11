# Dentara Build Log

## Brief

Build a small multi-user healthcare CRM with patient records, scheduling and conflict handling, a staff dashboard, two roles, and one AI-assisted feature. Continue the supplied Dentara Astro clinic site and use Python/FastAPI for the backend.

## What I built

### Foundation and product direction

- Audited the existing public site and retained its visual language and patient-facing pages.
- Added `/staff` as a focused clinic workspace rather than mixing protected operations into public navigation.
- Chose a single FastAPI service with SQLAlchemy so the demo remains easy to run and straightforward to migrate to PostgreSQL.

### Data and API

- Added staff users, patients and appointments with relational ownership.
- Added JWT login, password hashing, token expiry, and reusable role guards.
- Added patient search and CRUD-oriented endpoints.
- Added doctor-scoped appointment queries and modification checks.
- Added interval-based conflict detection (`existing.start < requested.end` and `existing.end > requested.start`) with a useful `409` response.
- Added seed data so reviewers can understand the product immediately.

### Staff experience

- Built a responsive sign-in screen and dashboard matching the calm green Dentara visual system.
- Added role-aware navigation and actions.
- Added today metrics, an appointment timeline, searchable patient cards, appointment creation, and clear empty/error/success states.
- Added mobile navigation and accessible labels, dialogs, focusable form controls, and status messages.

### AI-assisted feature

- Implemented deterministic extractive note summarisation for doctors.
- Prioritises clinically relevant sentences (pain, allergies, medication, diagnosis, treatment and follow-up).
- Stores both the source note and generated summary for review.
- Deliberately runs without an external LLM, preventing patient text from leaving the API. The UI labels the output as a draft that must be reviewed.

### Verification

- Production Astro build completes successfully (15 static routes).
- API smoke test verifies health, login, patient access and dashboard access.
- Automated tests cover role denial, overlap rejection and doctor summary generation.

## Trade-offs and next iteration

- SQLite is ideal for a reviewer demo; PostgreSQL plus Alembic migrations should be used for multi-instance production deployment.
- The local summariser is private and predictable but less fluent than an LLM. A production LLM option should only use a healthcare-appropriate provider, explicit consent, a business associate agreement where applicable, redaction, auditing and human approval.
- Availability rules (clinic hours, buffers, leave and rooms) can become first-class database entities.
- Public booking remains an illustrative browser demo; a production version should use a narrowly scoped public endpoint plus verification and anti-abuse controls.
- Audit trails, MFA, fine-grained permissions, encrypted fields and retention workflows are required before real clinical use.

## AI Usage Report

AI was used as a pair-programming and review tool for:

- translating the brief into roles, entities, routes and acceptance cases;
- drafting the FastAPI/SQLAlchemy implementation and Astro staff interface;
- identifying edge cases in interval-overlap detection and role scoping;
- creating seed data, automated tests and documentation;
- checking the production build and debugging platform-specific dependency issues.

Human decisions retained: the product boundary, visual direction, local-only summarisation choice, security limitations, and final acceptance criteria. Every generated change was inspected and exercised locally. No real patient information was used or sent to any AI service.
