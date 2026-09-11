# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dental clinic visitors, front-desk staff, and doctors.

## Product Purpose

Extend the existing clinic website with a secure staff CRM for patient records, conflict-aware scheduling, daily operations, and assisted clinical-note review.

## Capabilities and Constraints

The public site keeps the existing Astro stack and visual system. The staff portal uses a Python FastAPI backend, relational persistence, expiring JWT sessions, and role-based access for front-desk and doctor workflows. Scheduling rejects overlaps for each doctor. Clinical-note summarisation is local and extractive so patient text is not sent to an external model. The public location is Karachi, Pakistan; sample data and booking policies are illustrative and must not be used for real clinical care.

## Evidence on Hand

Existing services and brand live in `src/content` and `src/styles/global.css`. Staff application code is in `src/pages/staff.astro` and `src/scripts/staff.ts`. The API, data models, security checks, seed data, and automated tests live under `backend/`.
