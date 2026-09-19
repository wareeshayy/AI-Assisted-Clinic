from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from enum import Enum
from typing import Annotated

import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import Date, DateTime, ForeignKey, String, Text, create_engine, func, or_, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker


load_dotenv()

IS_VERCEL = bool(os.getenv("VERCEL"))
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////tmp/dentara.db" if IS_VERCEL else "sqlite:///./dentara.db")
SECRET_KEY = os.getenv("SECRET_KEY") or os.getenv("VERCEL_DEPLOYMENT_ID") or secrets.token_urlsafe(48)
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD")
TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "480"))
ALGORITHM = "HS256"


class Base(DeclarativeBase):
    pass


connect_args = {"check_same_thread": False, "timeout": 30} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Role(str, Enum):
    front_desk = "front_desk"
    doctor = "doctor"


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(30), index=True)
    specialty: Mapped[str | None] = mapped_column(String(120), nullable=True)
    active: Mapped[bool] = mapped_column(default=True)


class Patient(Base):
    __tablename__ = "patients"
    id: Mapped[int] = mapped_column(primary_key=True)
    first_name: Mapped[str] = mapped_column(String(80), index=True)
    last_name: Mapped[str] = mapped_column(String(80), index=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[str] = mapped_column(String(30), index=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    allergies: Mapped[str | None] = mapped_column(Text, nullable=True)
    medical_history: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    appointments: Mapped[list[Appointment]] = relationship(back_populates="patient", cascade="all, delete-orphan")


class Appointment(Base):
    __tablename__ = "appointments"
    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    service: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(30), default="scheduled", index=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    patient: Mapped[Patient] = relationship(back_populates="appointments")
    doctor: Mapped[User] = relationship(foreign_keys=[doctor_id])


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    role: Role
    specialty: str | None = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class PatientIn(BaseModel):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    email: EmailStr | None = None
    phone: str = Field(min_length=7, max_length=30)
    date_of_birth: date | None = None
    address: str | None = Field(default=None, max_length=255)
    allergies: str | None = None
    medical_history: str | None = None


class PatientOut(PatientIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime


class AppointmentIn(BaseModel):
    patient_id: int
    doctor_id: int
    starts_at: datetime
    ends_at: datetime
    service: str = Field(min_length=2, max_length=120)
    reason: str | None = None

    def normalized(self):
        start = self.starts_at if self.starts_at.tzinfo else self.starts_at.replace(tzinfo=timezone.utc)
        end = self.ends_at if self.ends_at.tzinfo else self.ends_at.replace(tzinfo=timezone.utc)
        if end <= start:
            raise HTTPException(422, "Appointment must end after it starts")
        if end - start > timedelta(hours=4):
            raise HTTPException(422, "Appointment cannot exceed four hours")
        return start, end


class AppointmentUpdate(BaseModel):
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    doctor_id: int | None = None
    service: str | None = None
    reason: str | None = None
    status: str | None = None
    notes: str | None = None


class AppointmentOut(BaseModel):
    id: int
    patient_id: int
    patient_name: str
    doctor_id: int
    doctor_name: str
    starts_at: datetime
    ends_at: datetime
    service: str
    status: str
    reason: str | None
    notes: str | None
    summary: str | None


class DashboardOut(BaseModel):
    appointments_today: int
    waiting: int
    completed_today: int
    total_patients: int
    appointments: list[AppointmentOut]


class SummaryRequest(BaseModel):
    notes: str = Field(min_length=10, max_length=8000)


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 210_000).hex()
    return f"pbkdf2_sha256${salt}${digest}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        _, salt, expected = encoded.split("$", 2)
        actual = hash_password(password, salt).split("$", 2)[2]
        return hmac.compare_digest(actual, expected)
    except ValueError:
        return False


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def current_user(token: Annotated[str, Depends(oauth2)], db: Annotated[Session, Depends(get_db)]) -> User:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session")
    user = db.get(User, user_id)
    if not user or not user.active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User is inactive")
    return user


def allow(*roles: Role):
    def checker(user: Annotated[User, Depends(current_user)]):
        if user.role not in {r.value for r in roles}:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Your role cannot perform this action")
        return user
    return checker


def appt_out(item: Appointment) -> AppointmentOut:
    return AppointmentOut(
        id=item.id, patient_id=item.patient_id,
        patient_name=f"{item.patient.first_name} {item.patient.last_name}",
        doctor_id=item.doctor_id, doctor_name=item.doctor.name,
        starts_at=item.starts_at, ends_at=item.ends_at, service=item.service,
        status=item.status, reason=item.reason, notes=item.notes, summary=item.summary,
    )


def ensure_no_conflict(db: Session, doctor_id: int, start: datetime, end: datetime, exclude_id: int | None = None):
    query = select(Appointment).where(
        Appointment.doctor_id == doctor_id,
        Appointment.status.not_in(["cancelled", "no_show"]),
        Appointment.starts_at < end,
        Appointment.ends_at > start,
    )
    if exclude_id:
        query = query.where(Appointment.id != exclude_id)
    conflict = db.scalar(query.limit(1))
    if conflict:
        raise HTTPException(status.HTTP_409_CONFLICT, detail={
            "message": "This doctor already has an appointment during that time.",
            "conflicting_appointment_id": conflict.id,
            "starts_at": conflict.starts_at.isoformat(), "ends_at": conflict.ends_at.isoformat(),
        })


def summarize_notes(notes: str) -> str:
    """Safe local extractive summary: deterministic, explainable, and no PHI leaves the server."""
    cleaned = " ".join(notes.split())
    sentences = [s.strip() for s in cleaned.replace("!", ".").replace("?", ".").split(".") if s.strip()]
    keywords = ("pain", "allerg", "medicat", "diagnos", "treatment", "follow", "x-ray", "bleed", "swelling")
    ranked = sorted(enumerate(sentences), key=lambda pair: (sum(k in pair[1].lower() for k in keywords), -pair[0]), reverse=True)
    chosen = sorted(ranked[:3], key=lambda pair: pair[0])
    return ". ".join(sentence for _, sentence in chosen)[:700] + ("." if chosen else "")


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    seed_database()
    yield


app = FastAPI(title="Dentara Clinic CRM API", version="1.0.0", description="Secure clinic CRM and appointment scheduling API", lifespan=lifespan)
origins = [x.strip() for x in os.getenv("FRONTEND_ORIGINS", "http://localhost:4321,http://127.0.0.1:4321").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health():
    return {"status": "healthy", "service": "dentara-api"}


@app.post("/api/auth/login", response_model=Token)
def login(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: Annotated[Session, Depends(get_db)]):
    user = db.scalar(select(User).where(func.lower(User.email) == form.username.lower()))
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    expires = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_MINUTES)
    token = jwt.encode({"sub": str(user.id), "role": user.role, "exp": expires}, SECRET_KEY, algorithm=ALGORITHM)
    return Token(access_token=token, user=UserOut.model_validate(user))


@app.post("/api/auth/demo/{role}", response_model=Token)
def demo_login(role: Role, db: Annotated[Session, Depends(get_db)]):
    if not (IS_VERCEL or os.getenv("ENABLE_DEMO_LOGIN") == "true"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Demo login is not enabled")
    user = db.scalar(select(User).where(User.role == role.value, User.active.is_(True)).order_by(User.id))
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Demo user not found")
    expires = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_MINUTES)
    token = jwt.encode({"sub": str(user.id), "role": user.role, "exp": expires}, SECRET_KEY, algorithm=ALGORITHM)
    return Token(access_token=token, user=UserOut.model_validate(user))


@app.get("/api/auth/me", response_model=UserOut)
def me(user: Annotated[User, Depends(current_user)]):
    return user


@app.get("/api/staff/doctors", response_model=list[UserOut])
def doctors(db: Annotated[Session, Depends(get_db)], _: Annotated[User, Depends(current_user)]):
    return list(db.scalars(select(User).where(User.role == Role.doctor.value, User.active.is_(True)).order_by(User.name)))


@app.get("/api/patients", response_model=list[PatientOut])
def patients(db: Annotated[Session, Depends(get_db)], _: Annotated[User, Depends(current_user)], q: str = ""):
    query = select(Patient)
    if q.strip():
        term = f"%{q.strip()}%"
        query = query.where(or_(Patient.first_name.ilike(term), Patient.last_name.ilike(term), Patient.phone.ilike(term), Patient.email.ilike(term)))
    return list(db.scalars(query.order_by(Patient.created_at.desc()).limit(100)))


@app.post("/api/patients", response_model=PatientOut, status_code=201)
def create_patient(data: PatientIn, db: Annotated[Session, Depends(get_db)], _: Annotated[User, Depends(allow(Role.front_desk))]):
    duplicate = db.scalar(select(Patient).where(Patient.phone == data.phone))
    if duplicate:
        raise HTTPException(409, "A patient with this phone number already exists")
    item = Patient(**data.model_dump())
    db.add(item); db.commit(); db.refresh(item)
    return item


@app.get("/api/patients/{patient_id}")
def patient_detail(patient_id: int, db: Annotated[Session, Depends(get_db)], _: Annotated[User, Depends(current_user)]):
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(404, "Patient not found")
    return {"patient": PatientOut.model_validate(patient), "appointments": [appt_out(x) for x in sorted(patient.appointments, key=lambda a: a.starts_at, reverse=True)]}


@app.put("/api/patients/{patient_id}", response_model=PatientOut)
def update_patient(patient_id: int, data: PatientIn, db: Annotated[Session, Depends(get_db)], _: Annotated[User, Depends(current_user)]):
    patient = db.get(Patient, patient_id)
    if not patient: raise HTTPException(404, "Patient not found")
    for key, value in data.model_dump().items(): setattr(patient, key, value)
    db.commit(); db.refresh(patient); return patient


@app.get("/api/appointments", response_model=list[AppointmentOut])
def appointments(db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(current_user)], start: datetime | None = None, end: datetime | None = None):
    query = select(Appointment).order_by(Appointment.starts_at)
    if user.role == Role.doctor.value: query = query.where(Appointment.doctor_id == user.id)
    if start: query = query.where(Appointment.starts_at >= start)
    if end: query = query.where(Appointment.starts_at < end)
    return [appt_out(x) for x in db.scalars(query)]


@app.post("/api/appointments", response_model=AppointmentOut, status_code=201)
def create_appointment(data: AppointmentIn, db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(current_user)]):
    start, end = data.normalized()
    if user.role == Role.doctor.value and data.doctor_id != user.id:
        raise HTTPException(403, "Doctors can only schedule themselves")
    if not db.get(Patient, data.patient_id): raise HTTPException(404, "Patient not found")
    doctor = db.get(User, data.doctor_id)
    if not doctor or doctor.role != Role.doctor.value: raise HTTPException(422, "Selected staff member is not a doctor")
    ensure_no_conflict(db, data.doctor_id, start, end)
    item = Appointment(**data.model_dump(exclude={"starts_at", "ends_at"}), starts_at=start, ends_at=end, created_by=user.id)
    db.add(item); db.commit(); db.refresh(item)
    return appt_out(item)


@app.patch("/api/appointments/{appointment_id}", response_model=AppointmentOut)
def update_appointment(appointment_id: int, data: AppointmentUpdate, db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(current_user)]):
    item = db.get(Appointment, appointment_id)
    if not item: raise HTTPException(404, "Appointment not found")
    if user.role == Role.doctor.value and item.doctor_id != user.id: raise HTTPException(403, "This appointment belongs to another doctor")
    values = data.model_dump(exclude_unset=True)
    start = values.get("starts_at", item.starts_at); end = values.get("ends_at", item.ends_at); doctor_id = values.get("doctor_id", item.doctor_id)
    if end <= start: raise HTTPException(422, "Appointment must end after it starts")
    if values.get("status", item.status) not in {"cancelled", "no_show"}: ensure_no_conflict(db, doctor_id, start, end, item.id)
    if user.role == Role.front_desk.value and "notes" in values: raise HTTPException(403, "Clinical notes are doctor-only")
    for key, value in values.items(): setattr(item, key, value)
    db.commit(); db.refresh(item); return appt_out(item)


@app.post("/api/appointments/{appointment_id}/summarize")
def summarize(appointment_id: int, data: SummaryRequest, db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(allow(Role.doctor))]):
    item = db.get(Appointment, appointment_id)
    if not item: raise HTTPException(404, "Appointment not found")
    if item.doctor_id != user.id: raise HTTPException(403, "This appointment belongs to another doctor")
    item.notes = data.notes
    item.summary = summarize_notes(data.notes)
    db.commit()
    return {"summary": item.summary, "privacy": "Generated locally; no patient data was sent to an external AI provider."}


@app.get("/api/dashboard", response_model=DashboardOut)
def dashboard(db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(current_user)]):
    today = datetime.now().astimezone().date()
    start = datetime.combine(today, datetime.min.time()).astimezone(timezone.utc).replace(tzinfo=None)
    end = start + timedelta(days=1)
    query = select(Appointment).where(Appointment.starts_at >= start, Appointment.starts_at < end).order_by(Appointment.starts_at)
    if user.role == Role.doctor.value: query = query.where(Appointment.doctor_id == user.id)
    items = list(db.scalars(query))
    return DashboardOut(
        appointments_today=len(items), waiting=sum(x.status == "checked_in" for x in items),
        completed_today=sum(x.status == "completed" for x in items),
        total_patients=db.scalar(select(func.count(Patient.id))) or 0,
        appointments=[appt_out(x) for x in items],
    )


def seed_database():
    with SessionLocal() as db:
        if db.scalar(select(func.count(User.id))): return
        seed_password = DEMO_PASSWORD or secrets.token_urlsafe(48)
        front = User(name="Ayesha Khan", email="frontdesk@dentara.test", password_hash=hash_password(seed_password), role=Role.front_desk.value)
        doctor = User(name="Dr. Sarah Johnson", email="doctor@dentara.test", password_hash=hash_password(seed_password), role=Role.doctor.value, specialty="General Dentistry")
        doctor2 = User(name="Dr. Michael Chen", email="michael@dentara.test", password_hash=hash_password(seed_password), role=Role.doctor.value, specialty="Orthodontics")
        db.add_all([front, doctor, doctor2]); db.flush()
        patients = [
            Patient(first_name="Maya", last_name="Patel", email="maya@example.com", phone="+92 300 555 0101", date_of_birth=date(1992, 5, 14), allergies="Penicillin", medical_history="Mild asthma"),
            Patient(first_name="Omar", last_name="Ahmed", email="omar@example.com", phone="+92 301 555 0102", date_of_birth=date(1985, 11, 2), allergies="None known", medical_history="Type 2 diabetes; controlled"),
            Patient(first_name="Lina", last_name="Khan", email="lina@example.com", phone="+92 302 555 0103", date_of_birth=date(2001, 8, 21), allergies="Latex", medical_history="No significant history"),
        ]
        db.add_all(patients); db.flush()
        local_now = datetime.now().astimezone()
        day = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
        slots = [(9, 0, patients[0], doctor, "General checkup", "Routine cleaning", "checked_in"), (10, 30, patients[1], doctor, "Emergency care", "Lower-left tooth pain", "scheduled"), (14, 0, patients[2], doctor2, "Orthodontic consultation", "Aligner assessment", "scheduled")]
        for hour, minute, patient, clinician, service, reason, state in slots:
            starts = (day + timedelta(hours=hour, minutes=minute)).astimezone(timezone.utc).replace(tzinfo=None)
            db.add(Appointment(patient_id=patient.id, doctor_id=clinician.id, starts_at=starts, ends_at=starts + timedelta(minutes=45), service=service, reason=reason, status=state, created_by=front.id))
        db.commit()
