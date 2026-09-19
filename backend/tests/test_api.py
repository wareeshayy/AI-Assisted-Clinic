import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

TEST_PASSWORD = secrets.token_urlsafe(24)
os.environ["SECRET_KEY"] = secrets.token_urlsafe(48)
os.environ["DEMO_PASSWORD"] = TEST_PASSWORD

from app.main import app


def login(client, email):
    response = client.post("/api/auth/login", data={"username": email, "password": TEST_PASSWORD})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_health_and_role_permissions():
    with TestClient(app) as client:
        assert client.get("/api/health").json()["status"] == "healthy"
        doctor = login(client, "doctor@dentara.test")
        response = client.post("/api/patients", headers=doctor, json={
            "first_name": "Test", "last_name": "Patient", "phone": "+92 999 001 0000"
        })
        assert response.status_code == 403


def test_hosted_demo_login(monkeypatch):
    monkeypatch.setenv("ENABLE_DEMO_LOGIN", "true")
    with TestClient(app) as client:
        response = client.post("/api/auth/demo/front_desk")
        assert response.status_code == 200
        assert response.json()["user"]["role"] == "front_desk"


def test_rejects_overlapping_appointments():
    with TestClient(app) as client:
        front = login(client, "frontdesk@dentara.test")
        patients = client.get("/api/patients", headers=front).json()
        doctors = client.get("/api/staff/doctors", headers=front).json()
        start = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=30)
        first = {
            "patient_id": patients[0]["id"], "doctor_id": doctors[0]["id"],
            "starts_at": start.isoformat(), "ends_at": (start + timedelta(minutes=45)).isoformat(),
            "service": "General checkup", "reason": "Routine exam",
        }
        assert client.post("/api/appointments", headers=front, json=first).status_code == 201
        overlap = {**first, "patient_id": patients[1]["id"], "starts_at": (start + timedelta(minutes=15)).isoformat(), "ends_at": (start + timedelta(hours=1)).isoformat()}
        response = client.post("/api/appointments", headers=front, json=overlap)
        assert response.status_code == 409
        assert "already has an appointment" in response.json()["detail"]["message"]


def test_doctor_can_generate_local_summary():
    with TestClient(app) as client:
        doctor = login(client, "doctor@dentara.test")
        appointments = client.get("/api/appointments", headers=doctor).json()
        response = client.post(f"/api/appointments/{appointments[0]['id']}/summarize", headers=doctor, json={
            "notes": "Patient reports sharp pain for three days. X-ray shows a small cavity. Treatment discussed and follow-up arranged in two weeks."
        })
        assert response.status_code == 200
        assert "pain" in response.json()["summary"].lower()
        assert "no patient data" in response.json()["privacy"].lower()
