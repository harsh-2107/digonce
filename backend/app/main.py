import os
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import json
from urllib import error as urlerror
from urllib import request as urlrequest

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from shapely.geometry import shape, mapping
from geoalchemy2 import Geometry
from geoalchemy2.shape import from_shape, to_shape
from sqlalchemy import (
    create_engine, text, Column, String, Boolean, DateTime, Date, ForeignKey, Integer, Numeric, func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
import psycopg2

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/postgres")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-key-for-dev")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

# --- Database setup ---
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

# Make sure PostGIS is available before defining/creating geometry columns.
with engine.connect() as conn:
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
    conn.commit()

class User(Base):
    __tablename__ = "users"

    user_id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    department = Column(String)
    phone = Column(String)
    role = Column(String)

class Project(Base):
    __tablename__ = "projects"
    project_id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_name = Column(String, nullable=False)
    description = Column(String)
    created_by = Column(String, ForeignKey("users.user_id"), nullable=False)
    # The original fields remain for backwards compatibility with the first prototype.
    # The fields below implement the planned excavation-project workflow.
    status = Column(String, default="Draft", nullable=False)
    is_joint_project = Column(Boolean, default=False)
    geometry = Column(Geometry(geometry_type="GEOMETRY", srid=4326))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    project_type = Column(String)
    urgency = Column(String, default="Planned")
    department_id = Column(String)
    start_date = Column(Date)
    end_date = Column(Date)
    estimated_cost = Column(Numeric(14, 2))
    excavation_cost = Column(Numeric(14, 2))
    restoration_cost = Column(Numeric(14, 2))
    traffic_management_cost = Column(Numeric(14, 2))
    excavation_width_m = Column(Numeric(10, 2))
    excavation_depth_m = Column(Numeric(10, 2))
    contractor_name = Column(String)
    excavation_geometry = Column(Geometry(geometry_type="GEOMETRY", srid=4326))
    corridor_length_m = Column(Numeric(14, 2))
    duration_days = Column(Integer)
    risk_level = Column(String)
    risk_score = Column(Integer)
    risk_factors = Column(String)
    coordination_opportunity = Column(String)
    grouping_status = Column(String, default="NONE")
    created_by_user = relationship("User", foreign_keys=[created_by])

class ProjectDepartment(Base):
    __tablename__ = "project_departments"
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(PG_UUID(as_uuid=True), ForeignKey("projects.project_id"), nullable=False)
    department = Column(String, nullable=False)

class ProjectInfra(Base):
    __tablename__ = "project_infra"
    infra_id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(PG_UUID(as_uuid=True), ForeignKey("projects.project_id"), nullable=False)
    infra_type = Column(String, nullable=False)
    name = Column(String, nullable=False)
    department = Column(String)
    geometry = Column(Geometry(geometry_type="GEOMETRY", srid=4326))

class ProjectReview(Base):
    __tablename__ = "project_reviews"
    review_id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(PG_UUID(as_uuid=True), ForeignKey("projects.project_id"), nullable=False)
    department = Column(String, nullable=False)
    reviewer_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    status = Column(String, default="Pending")
    objection = Column(Boolean, default=False)
    comment = Column(String)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

Base.metadata.create_all(bind=engine)

# create_all intentionally does not alter an existing Docker volume.  Keep this small,
# idempotent compatibility migration so an already-running demo database gains the flow.
with engine.begin() as conn:
    conn.execute(text("""
        ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS project_type VARCHAR,
        ADD COLUMN IF NOT EXISTS start_date DATE,
        ADD COLUMN IF NOT EXISTS end_date DATE,
        ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(14,2),
        ADD COLUMN IF NOT EXISTS excavation_cost NUMERIC(14,2),
        ADD COLUMN IF NOT EXISTS restoration_cost NUMERIC(14,2),
        ADD COLUMN IF NOT EXISTS traffic_management_cost NUMERIC(14,2),
        ADD COLUMN IF NOT EXISTS excavation_width_m NUMERIC(10,2),
        ADD COLUMN IF NOT EXISTS excavation_depth_m NUMERIC(10,2),
        ADD COLUMN IF NOT EXISTS contractor_name VARCHAR,
        ADD COLUMN IF NOT EXISTS excavation_geometry geometry(GEOMETRY, 4326)
        , ADD COLUMN IF NOT EXISTS urgency VARCHAR DEFAULT 'Planned'
        , ADD COLUMN IF NOT EXISTS department_id VARCHAR
        , ADD COLUMN IF NOT EXISTS corridor_length_m NUMERIC(14,2)
        , ADD COLUMN IF NOT EXISTS duration_days INTEGER
        , ADD COLUMN IF NOT EXISTS risk_level VARCHAR
        , ADD COLUMN IF NOT EXISTS coordination_opportunity VARCHAR
        , ADD COLUMN IF NOT EXISTS grouping_status VARCHAR DEFAULT 'NONE'
        , ADD COLUMN IF NOT EXISTS risk_score INTEGER
        , ADD COLUMN IF NOT EXISTS risk_factors JSONB DEFAULT '{}'::jsonb
    """))
    # Coordination is intentionally separate from projects: participating work
    # keeps its own owner, budget and lifecycle throughout the negotiation.
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS project_conflicts (
            id UUID PRIMARY KEY, project_id UUID NOT NULL REFERENCES projects(project_id),
            other_project_id UUID NULL REFERENCES projects(project_id), utility_type VARCHAR NULL,
            conflict_type VARCHAR NOT NULL, distance_m NUMERIC, overlap_length_m NUMERIC,
            temporal_overlap_days INTEGER, schedule_gap_days INTEGER, reason TEXT,
            severity VARCHAR NOT NULL, status VARCHAR NOT NULL DEFAULT 'OPEN', factors JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS coordination_groups (
            id UUID PRIMARY KEY, group_code VARCHAR UNIQUE NOT NULL, name VARCHAR NOT NULL,
            recommended_start DATE, recommended_end DATE, final_start DATE, final_end DATE,
            coordination_type VARCHAR NOT NULL, coordination_score INTEGER NOT NULL,
            estimated_savings NUMERIC NOT NULL DEFAULT 0, status VARCHAR NOT NULL DEFAULT 'PENDING',
            created_by VARCHAR NOT NULL REFERENCES users(user_id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS coordination_group_projects (
            group_id UUID NOT NULL REFERENCES coordination_groups(id) ON DELETE CASCADE,
            project_id UUID NOT NULL REFERENCES projects(project_id), PRIMARY KEY (group_id, project_id)
        );
        CREATE TABLE IF NOT EXISTS coordination_proposals (
            id UUID PRIMARY KEY, proposal_code VARCHAR UNIQUE NOT NULL, group_id UUID NOT NULL REFERENCES coordination_groups(id) ON DELETE CASCADE,
            proposed_start DATE NOT NULL, proposed_end DATE NOT NULL, coordination_type VARCHAR NOT NULL,
            message TEXT, created_by VARCHAR NOT NULL REFERENCES users(user_id), status VARCHAR NOT NULL DEFAULT 'PENDING',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS coordination_responses (
            id UUID PRIMARY KEY, proposal_id UUID NOT NULL REFERENCES coordination_proposals(id) ON DELETE CASCADE,
            department VARCHAR NOT NULL, response VARCHAR NOT NULL, requested_start DATE NULL, requested_end DATE NULL,
            message TEXT, responded_by VARCHAR NOT NULL REFERENCES users(user_id), responded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(proposal_id, department)
        );
        CREATE TABLE IF NOT EXISTS notifications (
            id UUID PRIMARY KEY, recipient_user_id VARCHAR NOT NULL REFERENCES users(user_id), type VARCHAR NOT NULL,
            severity VARCHAR NOT NULL DEFAULT 'INFO', title VARCHAR NOT NULL, message TEXT NOT NULL,
            project_id UUID NULL REFERENCES projects(project_id), coordination_group_id UUID NULL REFERENCES coordination_groups(id),
            proposal_id UUID NULL REFERENCES coordination_proposals(id), action_required BOOLEAN NOT NULL DEFAULT false,
            read_at TIMESTAMPTZ NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS audit_logs (
            id UUID PRIMARY KEY, user_id VARCHAR NULL REFERENCES users(user_id), action VARCHAR NOT NULL,
            entity_type VARCHAR NOT NULL, entity_id VARCHAR NOT NULL, details JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS coordination_comments (
          id UUID PRIMARY KEY, group_id UUID NOT NULL REFERENCES coordination_groups(id) ON DELETE CASCADE,
          author_id VARCHAR NOT NULL REFERENCES users(user_id), department VARCHAR NOT NULL,
          message TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        ALTER TABLE coordination_proposals ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE coordination_comments ADD COLUMN IF NOT EXISTS proposal_id UUID NULL REFERENCES coordination_proposals(id) ON DELETE CASCADE;
        CREATE TABLE IF NOT EXISTS coordination_confirmations (
          id UUID PRIMARY KEY, group_id UUID NOT NULL REFERENCES coordination_groups(id) ON DELETE CASCADE,
          department VARCHAR NOT NULL, confirmed_by VARCHAR NOT NULL REFERENCES users(user_id), confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE(group_id, department)
        );
        CREATE TABLE IF NOT EXISTS coordination_events (
          id UUID PRIMARY KEY, group_id UUID NOT NULL REFERENCES coordination_groups(id) ON DELETE CASCADE,
          event_type VARCHAR NOT NULL, message TEXT, created_by VARCHAR NULL REFERENCES users(user_id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS coordination_comments_group_idx ON coordination_comments(group_id, created_at);
        CREATE INDEX IF NOT EXISTS project_conflicts_project_idx ON project_conflicts(project_id);
        CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON notifications(recipient_user_id, read_at);
        CREATE TABLE IF NOT EXISTS project_groups (
          id UUID PRIMARY KEY, group_code VARCHAR UNIQUE NOT NULL, department_id VARCHAR NOT NULL,
          name VARCHAR NOT NULL, description TEXT, group_type VARCHAR NOT NULL DEFAULT 'INTERNAL_CONSOLIDATION',
          status VARCHAR NOT NULL DEFAULT 'DRAFT', analysis_status VARCHAR NOT NULL DEFAULT 'CURRENT',
          geometry geometry(GEOMETRY,4326), excavation_geometry geometry(GEOMETRY,4326), urgency VARCHAR,
          recommended_start DATE, recommended_end DATE, final_start DATE, final_end DATE,
          excavation_width_m NUMERIC(10,2), excavation_depth_m NUMERIC(10,2), estimated_cost NUMERIC(14,2),
          estimated_excavation_cost NUMERIC(14,2), estimated_restoration_cost NUMERIC(14,2), estimated_traffic_management_cost NUMERIC(14,2),
          grouping_score INTEGER, grouping_level VARCHAR, estimated_savings NUMERIC(14,2) DEFAULT 0,
          estimated_disruption_reduction INTEGER DEFAULT 0, execution_strategy TEXT, created_by VARCHAR NOT NULL REFERENCES users(user_id),
          analysis_version INTEGER NOT NULL DEFAULT 1, last_analyzed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS project_group_projects (
          group_id UUID NOT NULL REFERENCES project_groups(id) ON DELETE CASCADE, project_id UUID NOT NULL REFERENCES projects(project_id),
          role VARCHAR NOT NULL DEFAULT 'SECONDARY', added_at TIMESTAMPTZ NOT NULL DEFAULT now(), removed_at TIMESTAMPTZ NULL,
          PRIMARY KEY (group_id, project_id)
        );
    """))

    # --- Deduplication migration: clean up duplicate coordination groups ------
    # Keep only the oldest group for each exact project pair; delete the rest.
    # Must delete child-table rows first to avoid foreign-key violations.
    conn.execute(text("""
        DO $$
        DECLARE
            dup_id UUID;
        BEGIN
            FOR dup_id IN (
                WITH ranked AS (
                    SELECT
                        g.id,
                        g.created_at,
                        ROW_NUMBER() OVER (
                            PARTITION BY (
                                SELECT string_agg(gp2.project_id::text, ',' ORDER BY gp2.project_id::text)
                                FROM coordination_group_projects gp2
                                WHERE gp2.group_id = g.id
                            )
                            ORDER BY g.created_at ASC
                        ) AS rn
                    FROM coordination_groups g
                )
                SELECT id FROM ranked WHERE rn > 1
            )
            LOOP
                DELETE FROM notifications          WHERE coordination_group_id = dup_id OR proposal_id IN (SELECT id FROM coordination_proposals WHERE group_id = dup_id);
                DELETE FROM coordination_events    WHERE group_id = dup_id;
                DELETE FROM coordination_comments  WHERE group_id = dup_id;
                DELETE FROM coordination_confirmations WHERE group_id = dup_id;
                DELETE FROM coordination_responses WHERE proposal_id IN (SELECT id FROM coordination_proposals WHERE group_id = dup_id);
                DELETE FROM coordination_proposals WHERE group_id = dup_id;
                DELETE FROM coordination_groups    WHERE id = dup_id;
            END LOOP;
        END $$;
    """))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Auth helpers ---
security = HTTPBearer()

def verify_password(plain_password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))

def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def create_access_token(user: User) -> str:
    payload = {
        "sub": user.user_id,
        "email": user.email,
        "role": user.role,
        "department": user.department,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# --- Seed DB ---
DEMO_USERS = {
    "admin@digonce.gov.in": {"password": "admin123", "name": "City Admin", "department": "super-admin", "role": "Super Admin"},
    "water@digonce.gov.in": {"password": "water123", "name": "Water Admin", "department": "water", "role": "Water Department Admin"},
    "sewage@digonce.gov.in": {"password": "sewage123", "name": "Sewage Admin", "department": "sewage", "role": "Sewage Department Admin"},
    "drainage@digonce.gov.in": {"password": "drainage123", "name": "Drainage Admin", "department": "drainage", "role": "Drainage Department Admin"},
    "gas@digonce.gov.in": {"password": "gas123", "name": "Gas Admin", "department": "natural-gas", "role": "Natural Gas Department Admin"},
    "fibre@digonce.gov.in": {"password": "fibre123", "name": "Fibre Admin", "department": "fibre", "role": "Fibre Department Admin"},
}

def seed_demo_users():
    db = SessionLocal()
    for email, u_data in DEMO_USERS.items():
        existing = db.query(User).filter(User.email == email).first()
        if not existing:
            new_user = User(
                user_id=str(uuid.uuid4()),
                name=u_data["name"],
                email=email,
                password_hash=hash_password(u_data["password"]),
                department=u_data["department"],
                role=u_data["role"],
            )
            db.add(new_user)
    db.commit()
    db.close()

# Seed initially when app loads
try:
    seed_demo_users()
except Exception as e:
    print("Warning: Could not seed DB on startup", e)

# --- GIS helpers ---
def geojson_to_geom(geojson: dict):
    try:
        return from_shape(shape(geojson), srid=4326)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid geometry")

def geom_to_geojson(geom):
    if geom is None:
        return None
    return mapping(to_shape(geom))

def serialize_project(p: Project) -> dict:
    return {
        "project_id": str(p.project_id),
        "project_name": p.project_name,
        "description": p.description,
        "created_by": p.created_by,
        "status": p.status,
        "is_joint_project": p.is_joint_project,
        "geometry": geom_to_geojson(p.geometry),
        "created_at": p.created_at,
        "updated_at": p.updated_at,
        "department": p.department_id or (p.created_by_user.department if hasattr(p, "created_by_user") and p.created_by_user else None),
        "department_id": p.department_id,
        "project_type": p.project_type,
        "urgency": p.urgency,
        "start_date": p.start_date,
        "end_date": p.end_date,
        "planned_start": p.start_date,
        "planned_end": p.end_date,
        "duration_days": p.duration_days,
        "corridor_length_m": float(p.corridor_length_m) if p.corridor_length_m is not None else None,
        "estimated_cost": float(p.estimated_cost) if p.estimated_cost is not None else None,
        "excavation_cost": float(p.excavation_cost) if p.excavation_cost is not None else None,
        "restoration_cost": float(p.restoration_cost) if p.restoration_cost is not None else None,
        "traffic_management_cost": float(p.traffic_management_cost) if p.traffic_management_cost is not None else None,
        "excavation_width_m": float(p.excavation_width_m) if p.excavation_width_m is not None else None,
        "excavation_depth_m": float(p.excavation_depth_m) if p.excavation_depth_m is not None else None,
        "contractor_name": p.contractor_name,
        "excavation_geometry": geom_to_geojson(p.excavation_geometry),
        "risk_level": p.risk_level or "Not calculated",
        "risk_score": p.risk_score,
        "risk_factors": json.loads(p.risk_factors) if isinstance(p.risk_factors, str) and p.risk_factors else (p.risk_factors or {}),
        "coordination_opportunity": p.coordination_opportunity or "Not calculated",
        "grouping_status": p.grouping_status or "NONE",
    }

def serialize_infra(i: ProjectInfra) -> dict:
    return {
        "infra_id": str(i.infra_id),
        "project_id": str(i.project_id),
        "infra_type": i.infra_type,
        "name": i.name,
        "department": i.department,
        "geometry": geom_to_geojson(i.geometry),
    }

def serialize_review(r: ProjectReview) -> dict:
    return {
        "review_id": str(r.review_id),
        "project_id": str(r.project_id),
        "department": r.department,
        "reviewer_id": r.reviewer_id,
        "status": r.status,
        "objection": r.objection,
        "comment": r.comment,
        "created_at": r.created_at,
        "updated_at": r.updated_at,
    }

# --- Schemas ---
class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class MeResponse(BaseModel):
    user_id: str
    name: str
    email: str
    department: str | None = None
    phone: str | None = None
    role: str | None = None

class ProjectCreate(BaseModel):
    project_name: str
    description: str | None = None
    is_joint_project: bool = False
    geometry: dict
    project_type: str
    urgency: str = "Planned"
    start_date: date
    end_date: date
    estimated_cost: Decimal | None = None
    excavation_cost: Decimal | None = None
    restoration_cost: Decimal | None = None
    traffic_management_cost: Decimal | None = None
    excavation_width_m: Decimal
    excavation_depth_m: Decimal | None = None
    contractor_name: str | None = None

class ProjectUpdate(BaseModel):
    project_name: str | None = None
    description: str | None = None
    status: str | None = None
    is_joint_project: bool | None = None
    geometry: dict | None = None
    description: str | None = None
    project_type: str | None = None
    urgency: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    estimated_cost: Decimal | None = None
    excavation_cost: Decimal | None = None
    restoration_cost: Decimal | None = None
    traffic_management_cost: Decimal | None = None
    excavation_width_m: Decimal | None = None
    excavation_depth_m: Decimal | None = None
    contractor_name: str | None = None

class ProjectTransition(BaseModel):
    status: str

class DepartmentsCreate(BaseModel):
    departments: list[str]

class InfraCreate(BaseModel):
    infra_type: str
    name: str
    department: str | None = None
    geometry: dict

class ReviewCreate(BaseModel):
    department: str
    status: str
    objection: bool = False
    comment: str | None = None

class ReviewUpdate(BaseModel):
    status: str | None = None
    objection: bool | None = None
    comment: str | None = None

class CoordinationGroupCreate(BaseModel):
    project_ids: list[str]
    coordination_type: str = "SAME_EXECUTION_WINDOW"
    message: str | None = None

class ProposalCreate(BaseModel):
    proposed_start: date
    proposed_end: date
    coordination_type: str = "SAME_EXECUTION_WINDOW"
    message: str | None = None

class CoordinationResponseCreate(BaseModel):
    message: str | None = None
    requested_start: date | None = None
    requested_end: date | None = None

class ProjectGroupCreate(BaseModel):
    project_ids: list[str]
    name: str | None = None
    description: str | None = None

class ProjectGroupUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    urgency: str | None = None
    final_start: date | None = None
    final_end: date | None = None
    excavation_width_m: Decimal | None = None
    excavation_depth_m: Decimal | None = None
    estimated_cost: Decimal | None = None
    estimated_excavation_cost: Decimal | None = None
    estimated_restoration_cost: Decimal | None = None
    estimated_traffic_management_cost: Decimal | None = None
    execution_strategy: str | None = None

class GroupProjectAdd(BaseModel):
    project_id: str

class CoordinationCommentCreate(BaseModel):
    message: str


# --- App ---
app = FastAPI(title="Municipal GIS Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:5173", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/auth/login", response_model=TokenResponse)
def login(credentials: LoginRequest, db=Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email.lower()).first()
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user)
    return TokenResponse(
        access_token=token, 
        user={
            "user_id": user.user_id,
            "name": user.name,
            "email": user.email,
            "department": user.department,
            "phone": user.phone,
            "role": user.role
        }
    )

@app.get("/auth/demo-accounts")
def demo_accounts():
    """Names and roles for the frontend's demo-account picker; passwords are never returned."""
    return [
        {"email": email, **{key: value for key, value in user.items() if key != "password"}}
        for email, user in DEMO_USERS.items()
    ]

@app.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(get_current_user)):
    return MeResponse(
        user_id=current_user.user_id,
        name=current_user.name,
        email=current_user.email,
        department=current_user.department,
        phone=current_user.phone,
        role=current_user.role,
    )

# --- Projects ---
PROJECT_TYPES = {"New Installation", "Repair", "Replacement", "Maintenance", "Expansion / Extension", "Rehabilitation"}
URGENCIES = {"Planned", "Urgent", "Emergency"}
PROJECT_STATUSES = {"Draft", "Submitted", "Under Review", "Coordination Required", "Approved", "Scheduled", "In Progress", "Restoration", "Verification", "Completed", "Rejected", "Cancelled"}
STATUS_TRANSITIONS = {"Draft": {"Submitted", "Cancelled"}, "Submitted": {"Under Review", "Rejected", "Cancelled"}, "Under Review": {"Coordination Required", "Approved", "Rejected"}, "Coordination Required": {"Approved", "Rejected"}, "Approved": {"Scheduled"}, "Scheduled": {"In Progress"}, "In Progress": {"Restoration"}, "Restoration": {"Verification"}, "Verification": {"Completed"}}

def ensure_project_payload(payload: ProjectCreate | ProjectUpdate):
    if getattr(payload, "project_type", None) and payload.project_type not in PROJECT_TYPES:
        raise HTTPException(status_code=422, detail="Unsupported project type")
    if getattr(payload, "urgency", None) and payload.urgency not in URGENCIES:
        raise HTTPException(status_code=422, detail="Urgency must be Planned, Urgent, or Emergency")
    if getattr(payload, "geometry", None):
        try:
            if shape(payload.geometry).geom_type != "LineString":
                raise ValueError("not a line")
        except Exception as error:
            raise HTTPException(status_code=422, detail="Project corridor must be a valid GeoJSON LINESTRING") from error
    if getattr(payload, "start_date", None) and getattr(payload, "end_date", None) and payload.end_date < payload.start_date:
        raise HTTPException(status_code=422, detail="Planned end must be on or after planned start")
    if getattr(payload, "excavation_width_m", None) is not None and payload.excavation_width_m <= 0:
        raise HTTPException(status_code=422, detail="Excavation width must be greater than zero")
    for field in ("excavation_depth_m", "estimated_cost", "excavation_cost", "restoration_cost", "traffic_management_cost"):
        value = getattr(payload, field, None)
        if value is not None and value < 0:
            raise HTTPException(status_code=422, detail=f"{field.replace('_', ' ').capitalize()} cannot be negative")
    costs = [getattr(payload, field, None) or Decimal(0) for field in ("excavation_cost", "restoration_cost", "traffic_management_cost")]
    estimated = getattr(payload, "estimated_cost", None)
    if estimated is not None and estimated < sum(costs):
        raise HTTPException(status_code=422, detail="Estimated cost must cover excavation, restoration, and traffic management costs")

def set_excavation_footprint(project: Project, width_m: Decimal):
    """Calculate the footprint server-side in metres; never accept it from the client."""
    project.excavation_geometry = func.ST_Transform(
        func.ST_Buffer(func.ST_Transform(project.geometry, 3857), float(width_m) / 2), 4326
    )
    project.corridor_length_m = func.ST_Length(func.ST_Transform(project.geometry, 3857))

def coordination_candidates(project: Project, db):
    """Lightweight proximity screen run on submission; replace with full PostGIS analysis later."""
    return db.query(Project).filter(
        Project.project_id != project.project_id,
        Project.status.notin_(["Cancelled", "Rejected"]),
        func.ST_DWithin(Project.geometry, project.geometry, 0.001),
    ).all()

def calculate_submission_analysis(project: Project, db):
    candidates = coordination_candidates(project, db)
    count = len(candidates)
    project.risk_level = "Critical" if count >= 4 else "High" if count >= 2 else "Medium" if count else "Low"
    project.coordination_opportunity = "Very High" if count >= 4 else "High" if count >= 2 else "Moderate" if count else "Low"
    return candidates

def days_overlap(a_start, a_end, b_start, b_end):
    start, end = max(a_start, b_start), min(a_end, b_end)
    return max(0, (end - start).days + 1)

def schedule_gap(a_start, a_end, b_start, b_end):
    if days_overlap(a_start, a_end, b_start, b_end):
        return 0
    return max((b_start - a_end).days - 1, (a_start - b_end).days - 1, 0)

def audit(db, user_id, action, entity_type, entity_id, details=None):
    db.execute(text("""INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
        VALUES (:id, :user_id, :action, :entity_type, :entity_id, CAST(:details AS jsonb))"""),
        {"id": str(uuid.uuid4()), "user_id": user_id, "action": action, "entity_type": entity_type,
         "entity_id": str(entity_id), "details": json.dumps(details or {}, default=lambda value: value.isoformat() if isinstance(value, (date, datetime)) else float(value) if isinstance(value, Decimal) else str(value))})

def notify_department(db, department, kind, title, message, project_id=None, group_id=None, proposal_id=None, action_required=True):
    users = db.query(User).filter(User.department == department).all()
    for recipient in users:
        db.execute(text("""INSERT INTO notifications (id, recipient_user_id, type, title, message, project_id, coordination_group_id, proposal_id, action_required)
            VALUES (:id,:recipient,:type,:title,:message,:project,:group,:proposal,:action)"""),
            {"id": str(uuid.uuid4()), "recipient": recipient.user_id, "type": kind, "title": title,
             "message": message, "project": project_id, "group": group_id, "proposal": proposal_id, "action": action_required})

def run_project_analysis(project: Project, db):
    """Deterministic PostGIS screening. Scores are prototype decision support, not engineering certification."""
    db.execute(text("DELETE FROM project_conflicts WHERE project_id = :id"), {"id": str(project.project_id)})
    utility_rows = db.execute(text("""
        SELECT utility_type, ROUND(ST_Distance(ST_Transform(geometry,3857), ST_Transform((SELECT geometry FROM projects WHERE project_id=:project),3857))::numeric, 1) distance_m
        FROM underground_networks WHERE utility_type <> 'roads'
        AND ST_DWithin(ST_Transform(geometry,3857), ST_Transform((SELECT geometry FROM projects WHERE project_id=:project),3857), 25)
    """), {"project": str(project.project_id)}).mappings().all()
    project_rows = db.query(Project).filter(Project.project_id != project.project_id, Project.status.notin_(["Cancelled", "Rejected"]), func.ST_DWithin(func.ST_Transform(Project.geometry,3857), func.ST_Transform(project.geometry,3857), 75)).all()
    for row in utility_rows:
        severity = "CRITICAL" if row["distance_m"] < 2 and row["utility_type"] == "natural-gas" else "HIGH" if row["distance_m"] < 5 else "MEDIUM"
        db.execute(text("""INSERT INTO project_conflicts (id,project_id,utility_type,conflict_type,distance_m,reason,severity,factors)
        VALUES (:id,:project,:utility,'UTILITY',:distance,:reason,:severity,CAST(:factors AS jsonb))"""),
        {"id":str(uuid.uuid4()),"project":str(project.project_id),"utility":row["utility_type"],"distance":row["distance_m"],
         "reason":f"{row['utility_type']} asset is within the 25 m screening corridor", "severity":severity,
         "factors":json.dumps({"distance_m":float(row["distance_m"]),"screening_radius_m":25})})
    opportunities = []
    for other in project_rows:
        pair = coordination_pair_analysis(project, other, db)
        overlap = pair["checks"]["temporal"]["overlap_days"]
        gap = pair["checks"]["temporal"]["schedule_gap_days"]
        score = pair["coordination_score"]["score"]
        if pair["recommendation"] in {"COORDINATE", "REVIEW"}:
            opportunities.append((other, score, overlap, gap))
            db.execute(text("""INSERT INTO project_conflicts (id,project_id,other_project_id,conflict_type,temporal_overlap_days,schedule_gap_days,reason,severity,factors)
            VALUES (:id,:project,:other,'PROJECT_SPATIAL',:overlap,:gap,:reason,:severity,CAST(:factors AS jsonb))"""),
            {"id":str(uuid.uuid4()),"project":str(project.project_id),"other":str(other.project_id),"overlap":overlap,"gap":gap,
             "reason":"Deterministic coordination pair analysis completed", "severity":"HIGH" if score >= 80 else "MEDIUM",
             "factors":json.dumps(pair)})
    risk = calculate_excavation_risk(project, db)
    project.risk_score = risk["score"]
    project.risk_level = risk["level"].title()
    project.risk_factors = json.dumps(risk)
    project.coordination_opportunity = ("Very High" if any(x[1] >= 85 for x in opportunities) else "High" if opportunities else "Low")
    return opportunities

RISK_POLICY = {"utility_exposure": .30, "utility_criticality": .15, "depth_interaction": .15, "road_sensitivity": .15, "restoration_recency": .10, "excavation_size": .05, "historical_excavation": .05, "data_uncertainty": .05}

def calculate_excavation_risk(project: Project, db) -> dict:
    """Prototype policy calculation. Inputs are PostGIS/GIS records, never Gemini."""
    rows = db.execute(text("""SELECT utility_type, properties, ROUND(ST_Distance(ST_Transform(geometry,3857),ST_Transform((SELECT excavation_geometry FROM projects WHERE project_id=:p),3857))::numeric,1) distance_m
      FROM underground_networks WHERE utility_type <> 'roads' AND ST_DWithin(ST_Transform(geometry,3857),ST_Transform((SELECT excavation_geometry FROM projects WHERE project_id=:p),3857),10)"""), {"p":str(project.project_id)}).mappings().all()
    def band(distance): return 100 if distance<=1 else 75 if distance<=2 else 50 if distance<=5 else 20 if distance<=10 else 0
    exposures=[band(float(row["distance_m"])) for row in rows]; max_exposure=max(exposures,default=0); exposure=min(100,max_exposure+min(25,max(0,len([x for x in exposures if x>=20])-1)*8))
    criticality=max([min(5,max(1,int((row["properties"] or {}).get("criticality",3)))) for row in rows] or [1]); criticality_score=round(max_exposure*criticality/5)
    depths=[(row["properties"] or {}).get("depth_m") for row in rows]; known_depths=[float(x) for x in depths if x is not None]
    depth_score=80 if known_depths and project.excavation_depth_m and any(abs(float(project.excavation_depth_m)-x)<=1 for x in known_depths) else 45 if not known_depths else 20
    road = db.execute(text("""SELECT properties FROM underground_networks WHERE utility_type='roads' ORDER BY ST_Distance(ST_Transform(geometry,3857),ST_Transform((SELECT geometry FROM projects WHERE project_id=:p),3857)) LIMIT 1"""), {"p":str(project.project_id)}).mappings().first()
    road_props=(road or {}).get("properties") or {}; traffic=str(road_props.get("traffic_level","MEDIUM")).upper(); road_score={"HIGH":85,"MEDIUM":55,"LOW":25}.get(traffic,55)
    restored=str(road_props.get("last_restored_at","")); restoration_score=70 if restored else 35
    size_score=min(100,round(float(project.excavation_width_m or 0)*12 + float(project.corridor_length_m or 0)/20))
    historical_score=min(100,max(0,len(rows)*12))
    uncertainty=80 if not known_depths else 45 if any((row["properties"] or {}).get("confidence_level") not in {"Verified","HIGH"} for row in rows) else 15
    factors={"utility_exposure":exposure,"utility_criticality":criticality_score,"depth_interaction":depth_score,"road_sensitivity":road_score,"restoration_recency":restoration_score,"excavation_size":size_score,"historical_excavation":historical_score,"data_uncertainty":uncertainty}
    score=round(sum(RISK_POLICY[key]*value for key,value in factors.items())); level="LOW" if score<25 else "MODERATE" if score<50 else "HIGH" if score<75 else "CRITICAL"
    return {"score":score,"level":level,"weights":RISK_POLICY,"factors":factors,"utility_assets_considered":len(rows),"assumption":"Configurable prototype screening policy; not an engineering approval."}

def invalidate_coordination_for_project(project: Project, db, user_id: str):
    """Project edits invalidate every proposal version that included the project."""
    groups = db.execute(text("SELECT group_id FROM coordination_group_projects WHERE project_id=:p"), {"p":str(project.project_id)}).scalars().all()
    for group_id in groups:
        group_projects_list=group_projects(db,group_id)
        window=common_window(group_projects_list)
        proposals=db.execute(text("SELECT id FROM coordination_proposals WHERE group_id=:g AND status IN ('PENDING','ACCEPTED')"),{"g":group_id}).scalars().all()
        for proposal_id in proposals:
            db.execute(text("DELETE FROM coordination_responses WHERE proposal_id=:p"),{"p":proposal_id})
            db.execute(text("UPDATE coordination_proposals SET version=version+1,status='PENDING',proposed_start=COALESCE(:start,proposed_start),proposed_end=COALESCE(:end,proposed_end),updated_at=now() WHERE id=:p"),{"p":proposal_id,"start":window[0] if window else None,"end":window[1] if window else None})
        db.execute(text("UPDATE coordination_groups SET status='PENDING',recommended_start=:start,recommended_end=:end,updated_at=now() WHERE id=:g"),{"g":group_id,"start":window[0] if window else None,"end":window[1] if window else None})
        db.execute(text("INSERT INTO coordination_events (id,group_id,event_type,message,created_by) VALUES (:id,:g,'PROPOSAL_RECALCULATED','A participating project changed; responses were invalidated and proposal version incremented.',:u)"),{"id":str(uuid.uuid4()),"g":group_id,"u":user_id})

# --- Deterministic coordination analysis ------------------------------------
# All decisions below come from PostGIS/domain rules. Gemini receives only the
# finished result and can only add a plain-language explanation.
DEPARTMENT_UTILITY = {"water": "WATER", "sewage": "SEWAGE", "drainage": "DRAINAGE", "natural-gas": "NATURAL_GAS", "fibre": "FIBRE"}
COMPATIBILITY = {
    frozenset(("WATER", "FIBRE")): "COMPATIBLE", frozenset(("WATER", "SEWAGE")): "CONDITIONAL",
    frozenset(("WATER", "DRAINAGE")): "CONDITIONAL", frozenset(("SEWAGE", "FIBRE")): "CONDITIONAL",
    frozenset(("SEWAGE", "DRAINAGE")): "CONDITIONAL", frozenset(("DRAINAGE", "FIBRE")): "CONDITIONAL",
    frozenset(("NATURAL_GAS", "FIBRE")): "CONDITIONAL", frozenset(("WATER", "NATURAL_GAS")): "RESTRICTED",
    frozenset(("SEWAGE", "NATURAL_GAS")): "RESTRICTED", frozenset(("DRAINAGE", "NATURAL_GAS")): "RESTRICTED",
}

def _json_safe(value):
    if isinstance(value, (date, datetime)): return value.isoformat()
    if isinstance(value, Decimal): return float(value)
    return value

def gemini_explanation(analysis: dict) -> str:
    if not GEMINI_API_KEY:
        return ""
    summary = {key: analysis[key] for key in ("conflict", "checks", "hard_blockers", "coordination_score", "recommendation", "reasons", "warnings")}
    prompt = "Explain this precomputed municipal excavation coordination result in 90 words or fewer. Do not change, question, or recalculate its recommendation; do not claim engineering certification. Focus on reasons, blockers, and next action.\n" + json.dumps(summary, default=_json_safe)
    body = json.dumps({"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.2, "maxOutputTokens": 180}}).encode()
    try:
        req = urlrequest.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}", data=body, headers={"Content-Type": "application/json"}, method="POST")
        with urlrequest.urlopen(req, timeout=8) as response:
            payload = json.loads(response.read().decode())
        return payload["candidates"][0]["content"]["parts"][0]["text"].strip()
    except urlerror.HTTPError:
        # Non-200 response (e.g., 403 permission denied, 429 quota exhausted, 404 model not found).
        # Silently omit the explanation; the deterministic result is still valid.
        return ""
    except (urlerror.URLError, KeyError, IndexError, json.JSONDecodeError):
        return ""

def coordination_pair_analysis(project: Project, candidate: Project, db, include_gemini=False) -> dict:
    spatial = db.execute(text("""
        SELECT ROUND(ST_Distance(ST_Transform(a.geometry,3857),ST_Transform(b.geometry,3857))::numeric,1) distance_m,
        ROUND(ST_Length(ST_Intersection(ST_Buffer(ST_Transform(a.geometry,3857),10),ST_Buffer(ST_Transform(b.geometry,3857),10)))::numeric,1) shared_corridor_m
        FROM projects a CROSS JOIN projects b WHERE a.project_id=:a AND b.project_id=:b
    """), {"a": str(project.project_id), "b": str(candidate.project_id)}).mappings().first()
    distance, shared = float(spatial["distance_m"]), float(spatial["shared_corridor_m"])
    overlap, gap = days_overlap(project.start_date, project.end_date, candidate.start_date, candidate.end_date), schedule_gap(project.start_date, project.end_date, candidate.start_date, candidate.end_date)
    utility_a, utility_b = DEPARTMENT_UTILITY.get(project.department_id, "UNKNOWN"), DEPARTMENT_UTILITY.get(candidate.department_id, "UNKNOWN")
    compatibility = "STRONG_CANDIDATE" if utility_a == utility_b else COMPATIBILITY.get(frozenset((utility_a, utility_b)), "CONDITIONAL")
    nearby_gas = db.execute(text("""SELECT count(*) FROM underground_networks u WHERE u.utility_type='natural-gas' AND (
      ST_DWithin(ST_Transform(u.geometry,3857),ST_Transform((SELECT geometry FROM projects WHERE project_id=:a),3857),5)
      OR ST_DWithin(ST_Transform(u.geometry,3857),ST_Transform((SELECT geometry FROM projects WHERE project_id=:b),3857),5))"""), {"a":str(project.project_id),"b":str(candidate.project_id)}).scalar()
    width_total = float(project.excavation_width_m or 0) + float(candidate.excavation_width_m or 0)
    hard_blockers, warnings, reasons = [], [], []
    if distance > 75: hard_blockers.append("Projects are outside the 75 m coordination corridor.")
    if gap > 14: hard_blockers.append("Schedules are more than 14 days apart with no useful coordination window.")
    if compatibility == "RESTRICTED" and distance < 10: hard_blockers.append("Natural-gas work within 10 m requires separate safety review and cannot be auto-coordinated.")
    if nearby_gas and width_total > 8: hard_blockers.append("Combined excavation width near a gas asset exceeds the prototype safe coordination threshold.")
    if overlap: reasons.append(f"Schedules overlap for {overlap} day(s).")
    elif gap <= 14: reasons.append(f"Schedules are {gap} day(s) apart, allowing a planned common window.")
    if shared >= 20: reasons.append(f"Projects share approximately {shared:.0f} m of corridor footprint.")
    if compatibility in {"COMPATIBLE", "STRONG_CANDIDATE"}: reasons.append(f"{utility_a.replace('_',' ').title()} and {utility_b.replace('_',' ').title()} work is compatible under the prototype matrix.")
    elif compatibility == "CONDITIONAL": warnings.append("Work types are conditionally compatible and require engineering review of separation and trench sequencing.")
    if project.urgency == "EMERGENCY" or candidate.urgency == "EMERGENCY": warnings.append("Emergency work needs rapid screening and explicit approval; urgency does not bypass utility checks.")
    if project.contractor_name and project.contractor_name == candidate.contractor_name: warnings.append("Both projects name the same contractor; confirm crew and equipment capacity.")
    if not project.excavation_depth_m or not candidate.excavation_depth_m: warnings.append("One or both excavation depths are missing; field verification is required.")
    spatial_score = max(0, 30 - min(30, distance / 2)) + min(20, shared / 10)
    temporal_score = 25 if overlap else max(0, 15 - gap)
    compatibility_score = {"STRONG_CANDIDATE": 20, "COMPATIBLE": 18, "CONDITIONAL": 10, "RESTRICTED": 0}[compatibility]
    road_score = 10 if shared >= 20 else 5 if distance <= 30 else 0
    score = 0 if hard_blockers else min(100, round(spatial_score + temporal_score + compatibility_score + road_score))
    level = "VERY_HIGH" if score >= 85 else "HIGH" if score >= 70 else "MODERATE" if score >= 45 else "LOW"
    conflict_types = (["PROJECT_SPATIAL"] if distance <= 75 else []) + (["PROJECT_TEMPORAL"] if overlap else [])
    recommendation = "DO_NOT_COORDINATE" if hard_blockers else "COORDINATE" if score >= 70 else "REVIEW" if score >= 45 else "INDEPENDENT"
    result = {"project_id": str(project.project_id), "candidate_project_id": str(candidate.project_id), "conflict": {"exists": bool(conflict_types), "types": conflict_types}, "checks": {
        "spatial": {"distance_m": distance, "shared_corridor_m": shared, "within_coordination_corridor": distance <= 75},
        "temporal": {"overlap_days": overlap, "schedule_gap_days": gap, "common_window": [max(project.start_date,candidate.start_date).isoformat(),min(project.end_date,candidate.end_date).isoformat()] if overlap else None},
        "work_compatibility": {"project_a_utility": utility_a, "project_b_utility": utility_b, "result": compatibility},
        "physical_feasibility": {"combined_excavation_width_m": round(width_total,2), "depths_known": bool(project.excavation_depth_m and candidate.excavation_depth_m)},
        "utility_constraints": {"natural_gas_assets_within_5m": nearby_gas},
        "road_impact": {"shared_road_opening_benefit": shared >= 20},
        "urgency": {"project_a": project.urgency, "project_b": candidate.urgency},
        "resource_feasibility": {"same_contractor": bool(project.contractor_name and project.contractor_name == candidate.contractor_name)},
        "data_confidence": {"result": "REVIEW_REQUIRED" if not project.excavation_depth_m or not candidate.excavation_depth_m else "SUFFICIENT_FOR_SCREENING"}},
        "hard_blockers": hard_blockers, "coordination_score": {"score": score, "level": level}, "recommendation": recommendation,
        "reasons": reasons, "warnings": warnings, "gemini_explanation": ""}
    if include_gemini: result["gemini_explanation"] = gemini_explanation(result)
    return result

@app.post("/projects")
def create_project(
    payload: ProjectCreate,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_project_payload(payload)
    project = Project(
        project_name=payload.project_name,
        description=payload.description,
        created_by=current_user.user_id,
        status="Draft",
        department_id=current_user.department,
        is_joint_project=payload.is_joint_project,
        geometry=geojson_to_geom(payload.geometry),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        project_type=payload.project_type,
        urgency=payload.urgency,
        start_date=payload.start_date,
        end_date=payload.end_date,
        duration_days=(payload.end_date - payload.start_date).days + 1,
        estimated_cost=payload.estimated_cost,
        excavation_cost=payload.excavation_cost,
        restoration_cost=payload.restoration_cost,
        traffic_management_cost=payload.traffic_management_cost,
        excavation_width_m=payload.excavation_width_m,
        excavation_depth_m=payload.excavation_depth_m,
        contractor_name=payload.contractor_name,
    )
    db.add(project)
    db.flush()
    set_excavation_footprint(project, payload.excavation_width_m)
    db.commit()
    db.refresh(project)
    return serialize_project(project)

@app.get("/projects")
def list_projects(
    status: str | None = None,
    department: str | None = None,
    project_type: str | None = None,
    urgency: str | None = None,
    is_joint_project: bool | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Project)
    if status:
        query = query.filter(Project.status == status)
    if is_joint_project is not None:
        query = query.filter(Project.is_joint_project == is_joint_project)
    if department:
        query = query.filter(Project.department_id == department)
    if project_type:
        query = query.filter(Project.project_type == project_type)
    if urgency:
        query = query.filter(Project.urgency == urgency)
 
    sort_columns = {
        "created_at": Project.created_at,
        "project_name": Project.project_name,
        "status": Project.status,
    }
    sort_col = sort_columns.get(sort_by, Project.created_at)
    query = query.order_by(sort_col.desc() if sort_order == "desc" else sort_col.asc())
 
    return [serialize_project(p) for p in query.all()]

@app.get("/projects/{project_id}")
def get_project(
    project_id: str,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return serialize_project(project)

@app.patch("/projects/{project_id}")
@app.put("/projects/{project_id}", include_in_schema=False)
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.created_by != current_user.user_id and current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Only the project creator or an Admin can update this project")
 
    ensure_project_payload(payload)
    if payload.project_name is not None:
        project.project_name = payload.project_name
    if payload.description is not None:
        project.description = payload.description
    if payload.status is not None:
        raise HTTPException(status_code=422, detail="Use the submit or cancel endpoint for status changes")
    if payload.is_joint_project is not None:
        project.is_joint_project = payload.is_joint_project
    if payload.geometry is not None:
        project.geometry = geojson_to_geom(payload.geometry)
    for field in ("project_type", "urgency", "start_date", "end_date", "estimated_cost", "excavation_cost", "restoration_cost", "traffic_management_cost", "excavation_width_m", "excavation_depth_m", "contractor_name"):
        value = getattr(payload, field)
        if value is not None:
            setattr(project, field, value)
    if payload.geometry is not None or payload.excavation_width_m is not None:
        set_excavation_footprint(project, project.excavation_width_m)
    if project.start_date and project.end_date:
        project.duration_days = (project.end_date - project.start_date).days + 1
    project.updated_at = datetime.now(timezone.utc)
    db.flush()
    db.refresh(project)
    
    # A change to an existing corridor, date, or excavation parameter requires
    # fresh screening before it can continue in the review workflow.
    if project.status != "Draft":
        opportunities = run_project_analysis(project, db)
        project.status = "Coordination Required" if opportunities else "Under Review"
        invalidate_coordination_for_project(project, db, current_user.user_id)
    audit(db, current_user.user_id, "PROJECT_UPDATED", "project", project.project_id)
 
    db.commit()
    db.refresh(project)
    return serialize_project(project)

@app.delete("/projects/{project_id}")
def delete_project(
    project_id: str,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.department_id != current_user.department and current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Only the owning department or City Admin can delete this project")
    # Permanent deletion is explicitly user-requested. Remove every dependent
    # workflow record first so no foreign-key reference silently keeps it alive.
    coordination_group_ids = db.execute(text("SELECT group_id FROM coordination_group_projects WHERE project_id=:id"), {"id": project_id}).scalars().all()
    internal_group_ids = db.execute(text("SELECT group_id FROM project_group_projects WHERE project_id=:id"), {"id": project_id}).scalars().all()
    if coordination_group_ids:
        db.execute(text("DELETE FROM notifications WHERE coordination_group_id = ANY(:ids) OR proposal_id IN (SELECT id FROM coordination_proposals WHERE group_id = ANY(:ids))"), {"ids": coordination_group_ids})
        db.execute(text("DELETE FROM coordination_groups WHERE id = ANY(:ids)"), {"ids": coordination_group_ids})
    if internal_group_ids:
        db.execute(text("DELETE FROM project_groups WHERE id = ANY(:ids)"), {"ids": internal_group_ids})
    db.execute(text("DELETE FROM notifications WHERE project_id=:id"), {"id": project_id})
    db.execute(text("DELETE FROM project_conflicts WHERE project_id=:id OR other_project_id=:id"), {"id": project_id})
    db.execute(text("DELETE FROM project_infra WHERE project_id=:id"), {"id": project_id})
    db.execute(text("DELETE FROM project_departments WHERE project_id=:id"), {"id": project_id})
    db.execute(text("DELETE FROM project_reviews WHERE project_id=:id"), {"id": project_id})
    audit(db, current_user.user_id, "PROJECT_DELETED", "project", project.project_id, {"project_name": project.project_name})
    db.delete(project)
    db.commit()
    return {"deleted": True, "project_id": project_id}

@app.post("/projects/{project_id}/submit")
def submit_project(project_id: str, db=Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.created_by != current_user.user_id and current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Only the project creator or City Admin can submit this project")
    if project.status != "Draft":
        raise HTTPException(status_code=409, detail="Only a draft project can be submitted")
    opportunities = run_project_analysis(project, db)
    project.status = "Coordination Required" if opportunities else "Under Review"
    project.updated_at = datetime.now(timezone.utc)
    audit(db, current_user.user_id, "PROJECT_SUBMITTED", "project", project.project_id, {"opportunities": len(opportunities)})
    db.commit()
    db.refresh(project)
    return serialize_project(project)

@app.get("/projects/{project_id}/coordination")
def project_coordination(project_id: str, include_explanation: bool = False, db=Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.status == "Draft":
        return {"risk_level": "Not calculated", "coordination_opportunity": "Not calculated", "projects": []}
    rows = db.execute(text("SELECT other_project_id, factors FROM project_conflicts WHERE project_id=:id AND other_project_id IS NOT NULL AND status='OPEN'"), {"id": str(project.project_id)}).mappings().all()
    candidates = []
    for row in rows:
        candidate = db.query(Project).filter(Project.project_id == row["other_project_id"]).first()
        if candidate and candidate.department_id != project.department_id:
            item = serialize_project(candidate)
            item["analysis"] = coordination_pair_analysis(project, candidate, db, include_explanation)
            candidates.append(item)
    return {"risk_level": project.risk_level or "Not calculated", "coordination_opportunity": project.coordination_opportunity or "Not calculated", "projects": candidates}

@app.get("/projects/{project_id}/coordination-opportunities/{candidate_project_id}")
def project_pair_coordination(project_id: str, candidate_project_id: str, include_explanation: bool = True, db=Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.project_id == project_id).first()
    candidate = db.query(Project).filter(Project.project_id == candidate_project_id).first()
    if not project or not candidate:
        raise HTTPException(status_code=404, detail="Project not found")
    return coordination_pair_analysis(project, candidate, db, include_explanation)

@app.post("/projects/{project_id}/analyze")
def analyze_project(project_id: str, db=Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project: raise HTTPException(status_code=404, detail="Project not found")
    if project.created_by != current_user.user_id and current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Only the owning department can run analysis")
    opportunities = run_project_analysis(project, db); db.commit()
    return {"project": serialize_project(project), "opportunities": len(opportunities)}

@app.get("/projects/{project_id}/conflicts")
def project_conflicts(project_id: str, db=Depends(get_db), current_user: User = Depends(get_current_user)):
    return [dict(row) for row in db.execute(text("SELECT id,utility_type,other_project_id,conflict_type,distance_m,temporal_overlap_days,schedule_gap_days,reason,severity,status,factors FROM project_conflicts WHERE project_id=:id ORDER BY severity"), {"id":project_id}).mappings()]

@app.get("/projects/{project_id}/risk")
def project_risk(project_id: str, db=Depends(get_db), current_user: User = Depends(get_current_user)):
    project=db.query(Project).filter(Project.project_id==project_id).first()
    if not project: raise HTTPException(status_code=404,detail="Project not found")
    return calculate_excavation_risk(project,db)

@app.get("/projects/{project_id}/coordination-opportunities")
def project_opportunities(project_id: str, db=Depends(get_db), current_user: User = Depends(get_current_user)):
    return project_coordination(project_id, db, current_user)

@app.post("/projects/{project_id}/transition")
def transition_project(project_id: str, payload: ProjectTransition, db=Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Only City Admin can progress workflow states")
    if payload.status not in PROJECT_STATUSES or payload.status not in STATUS_TRANSITIONS.get(project.status, set()):
        raise HTTPException(status_code=409, detail=f"Invalid transition from {project.status} to {payload.status}")
    project.status = payload.status
    project.updated_at = datetime.now(timezone.utc)
    db.flush()
    # Auto-complete any coordination groups whose all projects are now Completed
    if payload.status == "Completed":
        group_ids = db.execute(text("SELECT group_id FROM coordination_group_projects WHERE project_id=:p"), {"p": str(project.project_id)}).scalars().all()
        for gid in group_ids:
            _auto_complete_group_if_done(gid, db)
    db.commit(); db.refresh(project)
    return serialize_project(project)

@app.post("/projects/{project_id}/cancel")
def cancel_project(project_id: str, db=Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.created_by != current_user.user_id and current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Only the project creator or City Admin can cancel this project")
    if project.status not in {"Draft", "Submitted"}:
        raise HTTPException(status_code=409, detail="This project can no longer be cancelled")
    project.status = "Cancelled"
    project.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(project)
    return serialize_project(project)

@app.post("/projects/{project_id}/departments")
def add_departments(
    project_id: str,
    payload: DepartmentsCreate,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
 
    rows = [ProjectDepartment(project_id=project_id, department=d) for d in payload.departments]
    db.add_all(rows)
    db.commit()
    return [{"project_id": project_id, "department": d} for d in payload.departments]

@app.get("/projects/{project_id}/departments")
def get_departments(
    project_id: str,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(ProjectDepartment).filter(ProjectDepartment.project_id == project_id).all()
    return [{"project_id": str(r.project_id), "department": r.department} for r in rows]

@app.post("/projects/{project_id}/infra")
def add_infra(
    project_id: str,
    payload: InfraCreate,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
 
    infra = ProjectInfra(
        project_id=project_id,
        infra_type=payload.infra_type,
        name=payload.name,
        department=payload.department,
        geometry=geojson_to_geom(payload.geometry),
    )
    db.add(infra)
    db.commit()
    db.refresh(infra)
    return serialize_infra(infra)

@app.get("/projects/{project_id}/infra")
def get_infra(
    project_id: str,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(ProjectInfra).filter(ProjectInfra.project_id == project_id).all()
    return [serialize_infra(r) for r in rows]

@app.get("/projects/{project_id}/infra/{infra_id}")
def get_infra_item(
    project_id: str,
    infra_id: str,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    infra = (
        db.query(ProjectInfra)
        .filter(ProjectInfra.infra_id == infra_id, ProjectInfra.project_id == project_id)
        .first()
    )
    if not infra:
        raise HTTPException(status_code=404, detail="Infrastructure item not found")
    return serialize_infra(infra)

@app.post("/projects/{project_id}/reviews")
def add_review(
    project_id: str,
    payload: ReviewCreate,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
 
    now = datetime.now(timezone.utc)
    review = ProjectReview(
        project_id=project_id,
        department=payload.department,
        reviewer_id=current_user.user_id,
        status=payload.status,
        objection=payload.objection,
        comment=payload.comment,
        created_at=now,
        updated_at=now,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return serialize_review(review)

@app.get("/projects/{project_id}/reviews")
def get_reviews(
    project_id: str,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(ProjectReview).filter(ProjectReview.project_id == project_id).all()
    return [serialize_review(r) for r in rows]

@app.put("/projects/{project_id}/reviews/{review_id}")
def update_review(
    project_id: str,
    review_id: str,
    payload: ReviewUpdate,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = (
        db.query(ProjectReview)
        .filter(ProjectReview.review_id == review_id, ProjectReview.project_id == project_id)
        .first()
    )
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.reviewer_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only the reviewer who created this review can update it")
 
    if payload.status is not None:
        review.status = payload.status
    if payload.objection is not None:
        review.objection = payload.objection
    if payload.comment is not None:
        review.comment = payload.comment
    review.updated_at = datetime.now(timezone.utc)
 
    db.commit()
    db.refresh(review)
    return serialize_review(review)

# --- Coordination and notifications ---
def group_projects(db, group_id):
    rows = db.execute(text("SELECT project_id FROM coordination_group_projects WHERE group_id=:gid"), {"gid": str(group_id)}).scalars().all()
    return db.query(Project).filter(Project.project_id.in_(rows)).all()

def group_view(db, group_id):
    group = db.execute(text("SELECT * FROM coordination_groups WHERE id=:id"), {"id":str(group_id)}).mappings().first()
    if not group: raise HTTPException(status_code=404, detail="Coordination group not found")
    projects = group_projects(db, group_id)
    responses = db.execute(text("SELECT * FROM coordination_responses WHERE proposal_id IN (SELECT id FROM coordination_proposals WHERE group_id=:id) ORDER BY responded_at"), {"id":str(group_id)}).mappings().all()
    proposals = db.execute(text("SELECT * FROM coordination_proposals WHERE group_id=:id ORDER BY created_at DESC"), {"id":str(group_id)}).mappings().all()
    confirmations = db.execute(text("SELECT c.*, u.name AS confirmed_by_name FROM coordination_confirmations c JOIN users u ON u.user_id=c.confirmed_by WHERE c.group_id=:id ORDER BY c.confirmed_at"), {"id":str(group_id)}).mappings().all()
    events = db.execute(text("SELECT * FROM coordination_events WHERE group_id=:id ORDER BY created_at"), {"id":str(group_id)}).mappings().all()
    return {"group":dict(group), "projects":[serialize_project(p) for p in projects], "responses":[dict(r) for r in responses], "proposals":[dict(p) for p in proposals], "confirmations":[dict(r) for r in confirmations], "events":[dict(r) for r in events]}

def common_window(projects, requested_start=None, requested_end=None):
    start = max([p.start_date for p in projects] + ([requested_start] if requested_start else []))
    end = min([p.end_date for p in projects] + ([requested_end] if requested_end else []))
    return (start, end) if start <= end else None

@app.get("/coordination/opportunities")
def list_opportunities(db=Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.execute(text("""SELECT c.project_id,c.other_project_id,c.factors,p.project_name,p.department_id
      FROM project_conflicts c JOIN projects p ON p.project_id=c.other_project_id
      WHERE c.other_project_id IS NOT NULL AND c.status='OPEN'""")).mappings().all()
    return [dict(r) for r in rows]

@app.post("/coordination/groups")
def create_coordination_group(payload: CoordinationGroupCreate, db=Depends(get_db), current_user: User = Depends(get_current_user)):
    ids = list(dict.fromkeys(payload.project_ids))
    if len(ids) < 2: raise HTTPException(status_code=422, detail="Select at least two independent projects")
    projects = db.query(Project).filter(Project.project_id.in_(ids)).all()
    if len(projects) != len(ids): raise HTTPException(status_code=404, detail="One or more projects do not exist")
    if not any(p.department_id == current_user.department for p in projects) and current_user.role != "Super Admin":
        raise HTTPException(status_code=403, detail="Your department must participate in a coordination group")

    # --- Idempotency: return existing active group if one already covers the same project pair ---
    # Find any group whose member set exactly matches the requested set.
    sorted_ids = sorted(ids)
    existing_group_id = db.execute(text("""
        SELECT g.id FROM coordination_groups g
        WHERE g.status NOT IN ('BROKEN', 'COMPLETED')
          AND (
            SELECT array_agg(gp.project_id::text ORDER BY gp.project_id::text)
            FROM coordination_group_projects gp WHERE gp.group_id = g.id
          ) = CAST(:pair AS text[])
    """), {"pair": sorted_ids}).scalar()
    if existing_group_id:
        return group_view(db, str(existing_group_id))

    pair_blockers = []
    for index, left in enumerate(projects):
        for right in projects[index + 1:]:
            analysis = coordination_pair_analysis(left, right, db)
            if analysis["hard_blockers"]:
                pair_blockers.extend(analysis["hard_blockers"])
    if pair_blockers:
        raise HTTPException(status_code=422, detail={"message": "Selected projects cannot be auto-coordinated.", "hard_blockers": pair_blockers})
    window = common_window(projects)
    if not window: raise HTTPException(status_code=422, detail="No feasible common window across the selected project schedules")
    # Compute an initial score from pairwise analysis
    pair_scores = []
    for index, left in enumerate(projects):
        for right in projects[index + 1:]:
            pair_scores.append(coordination_pair_analysis(left, right, db)["coordination_score"]["score"])
    score = round(sum(pair_scores) / len(pair_scores)) if pair_scores else min(100, 65 + len(projects) * 10)
    gid, code = str(uuid.uuid4()), f"CG-{datetime.now().strftime('%y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    db.execute(text("""INSERT INTO coordination_groups (id,group_code,name,recommended_start,recommended_end,coordination_type,coordination_score,estimated_savings,created_by)
    VALUES (:id,:code,:name,:start,:end,:type,:score,:savings,:creator)"""), {"id":gid,"code":code,"name":f"Coordinated corridor — {projects[0].project_name}","start":window[0],"end":window[1],"type":payload.coordination_type,"score":score,"savings":sum(float(p.restoration_cost or 0) for p in projects[1:]),"creator":current_user.user_id})
    for project in projects: db.execute(text("INSERT INTO coordination_group_projects (group_id,project_id) VALUES (:g,:p)"), {"g":gid,"p":str(project.project_id)})
    audit(db,current_user.user_id,"COORDINATION_GROUP_CREATED","coordination_group",gid,{"project_ids":ids})
    db.commit(); return group_view(db,gid)

@app.get("/coordination/groups")
def list_groups(db=Depends(get_db), current_user: User = Depends(get_current_user)):
    return [dict(r) for r in db.execute(text("SELECT * FROM coordination_groups ORDER BY updated_at DESC")).mappings()]

@app.get("/coordination/groups/{group_id}")
def get_group(group_id: str, db=Depends(get_db), current_user: User = Depends(get_current_user)):
    return group_view(db,group_id)

@app.post("/coordination/groups/{group_id}/proposals")
def create_proposal(group_id: str, payload: ProposalCreate, db=Depends(get_db), current_user: User = Depends(get_current_user)):
    projects = group_projects(db,group_id)
    if not projects: raise HTTPException(status_code=404, detail="Coordination group not found")
    if not any(p.department_id == current_user.department for p in projects): raise HTTPException(status_code=403, detail="Only a participating department can propose")
    if payload.proposed_end < payload.proposed_start: raise HTTPException(status_code=422, detail="Proposal end must follow start")
    feasible = common_window(projects,payload.proposed_start,payload.proposed_end)
    if not feasible or feasible != (payload.proposed_start,payload.proposed_end): raise HTTPException(status_code=422, detail="Proposed window is not feasible for all participating projects")
    db.execute(text("UPDATE coordination_proposals SET status='SUPERSEDED',updated_at=now() WHERE group_id=:g AND status='PENDING'"),{"g":group_id})
    pid, code = str(uuid.uuid4()), f"CP-{datetime.now().strftime('%y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    db.execute(text("""INSERT INTO coordination_proposals (id,proposal_code,group_id,proposed_start,proposed_end,coordination_type,message,created_by)
      VALUES (:id,:code,:group,:start,:end,:type,:message,:creator)"""),{"id":pid,"code":code,"group":group_id,"start":payload.proposed_start,"end":payload.proposed_end,"type":payload.coordination_type,"message":payload.message,"creator":current_user.user_id})
    db.execute(text("UPDATE coordination_groups SET status='PENDING',updated_at=now() WHERE id=:g"),{"g":group_id})
    for department in set(p.department_id for p in projects if p.department_id != current_user.department):
        notify_department(db,department,"COORDINATION_PROPOSAL","New coordination proposal",f"{current_user.department.title()} proposed {payload.proposed_start} to {payload.proposed_end}.",group_id=group_id,proposal_id=pid)
    audit(db,current_user.user_id,"COORDINATION_PROPOSAL_CREATED","proposal",pid,{"group_id":group_id})
    db.commit(); return {"proposal_id":pid,"proposal_code":code,"status":"PENDING"}

@app.get("/coordination/proposals")
def list_proposals(db=Depends(get_db), current_user: User = Depends(get_current_user)):
    return [dict(r) for r in db.execute(text("""SELECT DISTINCT p.* FROM coordination_proposals p
      JOIN coordination_group_projects gp ON gp.group_id=p.group_id JOIN projects pr ON pr.project_id=gp.project_id
      WHERE pr.department_id=:d OR p.created_by=:u ORDER BY p.created_at DESC"""),{"d":current_user.department,"u":current_user.user_id}).mappings()]

@app.get("/coordination/proposals/{proposal_id}")
def get_proposal(proposal_id: str, db=Depends(get_db), current_user: User = Depends(get_current_user)):
    proposal=db.execute(text("SELECT * FROM coordination_proposals WHERE id=:id"),{"id":proposal_id}).mappings().first()
    if not proposal: raise HTTPException(status_code=404,detail="Proposal not found")
    return {"proposal":dict(proposal), **group_view(db,proposal["group_id"])}

@app.get("/coordination/groups/{group_id}/comments")
def list_coordination_comments(group_id: str, db=Depends(get_db), current_user: User = Depends(get_current_user)):
    group = group_view(db, group_id)
    # Group membership uses the cross-department relation; unrelated users
    # cannot read the shared discussion.
    departments = {project.department_id for project in group_projects(db, group_id)}
    if current_user.role != "Super Admin" and current_user.department not in departments:
        raise HTTPException(status_code=403, detail="Only participating departments can read this discussion")
    return [dict(row) for row in db.execute(text("""SELECT c.*, u.name AS author_name FROM coordination_comments c
      JOIN users u ON u.user_id=c.author_id WHERE c.group_id=:g ORDER BY c.created_at"""), {"g":group_id}).mappings()]

@app.post("/coordination/groups/{group_id}/comments")
def add_coordination_comment(group_id: str, payload: CoordinationCommentCreate, db=Depends(get_db), current_user: User = Depends(get_current_user)):
    message=payload.message.strip()
    if not message: raise HTTPException(status_code=422, detail="Comment message is required")
    departments={project.department_id for project in group_projects(db, group_id)}
    if current_user.role != "Super Admin" and current_user.department not in departments:
        raise HTTPException(status_code=403, detail="Only participating departments can comment")
    comment_id=str(uuid.uuid4())
    db.execute(text("INSERT INTO coordination_comments (id,group_id,author_id,department,message) VALUES (:id,:g,:author,:department,:message)"), {"id":comment_id,"g":group_id,"author":current_user.user_id,"department":current_user.department,"message":message})
    audit(db,current_user.user_id,"COORDINATION_COMMENT_CREATED","coordination_group",group_id,{"comment_id":comment_id})
    db.commit()
    return {"id":comment_id,"group_id":group_id,"author_id":current_user.user_id,"author_name":current_user.name,"department":current_user.department,"message":message,"created_at":datetime.now(timezone.utc)}

def _refresh_group_coordination_score(group_id, db):
    """Recompute coordination_score from live pairwise analysis and write it to the group."""
    projects = group_projects(db, group_id)
    if len(projects) < 2:
        return
    pair_scores = []
    for i, left in enumerate(projects):
        for right in projects[i + 1:]:
            pair_scores.append(coordination_pair_analysis(left, right, db)["coordination_score"]["score"])
    score = round(sum(pair_scores) / len(pair_scores)) if pair_scores else 0
    db.execute(text("UPDATE coordination_groups SET coordination_score=:score, updated_at=now() WHERE id=:g"), {"score": score, "g": str(group_id)})

def _auto_complete_group_if_done(group_id, db):
    """Transition coordination group to COMPLETED when all participating projects are Completed."""
    projects = group_projects(db, group_id)
    if projects and all(p.status == "Completed" for p in projects):
        db.execute(text("UPDATE coordination_groups SET status='COMPLETED', updated_at=now() WHERE id=:g AND status != 'COMPLETED'"), {"g": str(group_id)})
        db.execute(text("INSERT INTO coordination_events (id,group_id,event_type,message,created_by) VALUES (:id,:g,'STATUS_CHANGED','All participating projects completed. Coordination group automatically marked as Completed.',NULL)"), {"id": str(uuid.uuid4()), "g": str(group_id)})

def respond_to_proposal(proposal_id, response, payload, db, current_user):
    proposal=db.execute(text("SELECT * FROM coordination_proposals WHERE id=:id FOR UPDATE"),{"id":proposal_id}).mappings().first()
    if not proposal: raise HTTPException(status_code=404,detail="Proposal not found")
    if proposal["status"] != "PENDING": raise HTTPException(status_code=409,detail="This proposal is no longer awaiting responses")
    projects=group_projects(db,proposal["group_id"])
    if not any(p.department_id == current_user.department for p in projects): raise HTTPException(status_code=403,detail="Your department is not a participant")
    if response == "REJECTED" and not payload.message: raise HTTPException(status_code=422,detail="A rejection reason is required")
    db.execute(text("""INSERT INTO coordination_responses (id,proposal_id,department,response,requested_start,requested_end,message,responded_by)
    VALUES (:id,:proposal,:department,:response,:start,:end,:message,:user)
    ON CONFLICT (proposal_id,department) DO UPDATE SET response=EXCLUDED.response,requested_start=EXCLUDED.requested_start,requested_end=EXCLUDED.requested_end,message=EXCLUDED.message,responded_by=EXCLUDED.responded_by,responded_at=now()"""),{"id":str(uuid.uuid4()),"proposal":proposal_id,"department":current_user.department,"response":response,"start":payload.requested_start,"end":payload.requested_end,"message":payload.message,"user":current_user.user_id})
    required={p.department_id for p in projects}
    responses={r["department"]:r["response"] for r in db.execute(text("SELECT department,response FROM coordination_responses WHERE proposal_id=:p"),{"p":proposal_id}).mappings()}
    all_accepted = required <= {department for department,value in responses.items() if value=="ACCEPTED"}
    status_value="REJECTED" if "REJECTED" in responses.values() else "ACCEPTED" if all_accepted else "PENDING"
    db.execute(text("UPDATE coordination_proposals SET status=:status,updated_at=now() WHERE id=:id"),{"status":status_value,"id":proposal_id})
    if all_accepted:
        # All departments accepted: refresh score, set group to APPROVED
        _refresh_group_coordination_score(proposal["group_id"], db)
        db.execute(text("UPDATE coordination_groups SET status='APPROVED', final_start=:s, final_end=:e, updated_at=now() WHERE id=:g"),{"s":proposal["proposed_start"],"e":proposal["proposed_end"],"g":proposal["group_id"]})
        db.execute(text("INSERT INTO coordination_events (id,group_id,event_type,message,created_by) VALUES (:id,:g,'STATUS_CHANGED','All departments accepted the proposal. Coordination group automatically approved.',:u)"),{"id":str(uuid.uuid4()),"g":proposal["group_id"],"u":current_user.user_id})
        # Notify all departments about approval
        for dept in required:
            notify_department(db, dept, "COORDINATION_APPROVED", "Coordination proposal approved", f"All departments accepted. Coordination is now Approved.", group_id=str(proposal["group_id"]), proposal_id=proposal_id, action_required=False)
    else:
        notify_department(db, current_user.department,"COORDINATION_RESPONSE",f"Coordination proposal {status_value.title()}",payload.message or "A participant responded to the proposal.",group_id=str(proposal["group_id"]),proposal_id=proposal_id)
    audit(db,current_user.user_id,"COORDINATION_RESPONSE_SUBMITTED","proposal",proposal_id,{"response":response})
    db.commit(); return get_proposal(proposal_id,db,current_user)

@app.post("/coordination/proposals/{proposal_id}/accept")
def accept_proposal(proposal_id:str,payload:CoordinationResponseCreate,db=Depends(get_db),current_user:User=Depends(get_current_user)): return respond_to_proposal(proposal_id,"ACCEPTED",payload,db,current_user)
@app.post("/coordination/proposals/{proposal_id}/reject")
def reject_proposal(proposal_id:str,payload:CoordinationResponseCreate,db=Depends(get_db),current_user:User=Depends(get_current_user)): return respond_to_proposal(proposal_id,"REJECTED",payload,db,current_user)

@app.post("/coordination/groups/{group_id}/confirm")
def confirm_coordination_group(group_id:str, db=Depends(get_db), current_user:User=Depends(get_current_user)):
    group=db.execute(text("SELECT * FROM coordination_groups WHERE id=:id FOR UPDATE"),{"id":group_id}).mappings().first()
    if not group: raise HTTPException(status_code=404,detail="Coordination group not found")
    if group["status"] != "AWAITING_CONFIRMATION": raise HTTPException(status_code=409,detail="Explicit confirmation is available after every participant accepts the current proposal")
    departments={p.department_id for p in group_projects(db,group_id)}
    if current_user.department not in departments: raise HTTPException(status_code=403,detail="Only participating departments can confirm")
    db.execute(text("INSERT INTO coordination_confirmations (id,group_id,department,confirmed_by) VALUES (:id,:g,:d,:u) ON CONFLICT (group_id,department) DO NOTHING"),{"id":str(uuid.uuid4()),"g":group_id,"d":current_user.department,"u":current_user.user_id})
    confirmed=set(db.execute(text("SELECT department FROM coordination_confirmations WHERE group_id=:g"),{"g":group_id}).scalars().all())
    status_value="CONFIRMED" if departments <= confirmed else "AWAITING_CONFIRMATION"
    db.execute(text("UPDATE coordination_groups SET status=:status,updated_at=now() WHERE id=:g"),{"status":status_value,"g":group_id})
    db.execute(text("INSERT INTO coordination_events (id,group_id,event_type,message,created_by) VALUES (:id,:g,'PARTICIPANT_CONFIRMED',:message,:u)"),{"id":str(uuid.uuid4()),"g":group_id,"message":f"{current_user.department} confirmed the coordination plan.","u":current_user.user_id})
    audit(db,current_user.user_id,"COORDINATION_CONFIRMED","coordination_group",group_id,{"status":status_value});db.commit();return group_view(db,group_id)

@app.post("/coordination/groups/{group_id}/schedule")
def schedule_coordination_group(group_id:str, db=Depends(get_db), current_user:User=Depends(get_current_user)):
    group=db.execute(text("SELECT * FROM coordination_groups WHERE id=:id"),{"id":group_id}).mappings().first()
    if not group: raise HTTPException(status_code=404,detail="Coordination group not found")
    if group["status"] != "CONFIRMED": raise HTTPException(status_code=409,detail="All departments must explicitly confirm before scheduling")
    if current_user.role != "Super Admin": raise HTTPException(status_code=403,detail="Only City Admin can schedule the final joint execution plan")
    for project in group_projects(db,group_id): project.status="Scheduled"
    db.execute(text("UPDATE coordination_groups SET status='SCHEDULED',updated_at=now() WHERE id=:g"),{"g":group_id});db.commit();return group_view(db,group_id)

@app.post("/coordination/groups/{group_id}/revoke")
def revoke_coordination_group(group_id:str,payload:CoordinationResponseCreate,db=Depends(get_db),current_user:User=Depends(get_current_user)):
    departments={p.department_id for p in group_projects(db,group_id)}
    if current_user.department not in departments and current_user.role!="Super Admin": raise HTTPException(status_code=403,detail="Only a participant or City Admin can revoke")
    db.execute(text("UPDATE coordination_groups SET status='BROKEN',updated_at=now() WHERE id=:g"),{"g":group_id});db.execute(text("INSERT INTO coordination_events (id,group_id,event_type,message,created_by) VALUES (:id,:g,'COORDINATION_REVOKED',:message,:u)"),{"id":str(uuid.uuid4()),"g":group_id,"message":payload.message or "Coordination revoked for review.","u":current_user.user_id});audit(db,current_user.user_id,"COORDINATION_REVOKED","coordination_group",group_id);db.commit();return group_view(db,group_id)

@app.post("/coordination/groups/{group_id}/optimize")
def optimize_group(group_id:str,db=Depends(get_db),current_user:User=Depends(get_current_user)):
    projects=group_projects(db,group_id); responses=db.execute(text("SELECT requested_start,requested_end FROM coordination_responses WHERE proposal_id IN (SELECT id FROM coordination_proposals WHERE group_id=:g) AND response='MODIFICATION_REQUESTED' ORDER BY responded_at DESC"),{"g":group_id}).mappings().all()
    start=max([p.start_date for p in projects]+[r["requested_start"] for r in responses if r["requested_start"]]); end=min([p.end_date for p in projects]+[r["requested_end"] for r in responses if r["requested_end"]])
    if start>end: return {"feasible":False,"reason":"No common window satisfies all project schedules and requested modifications."}
    return {"feasible":True,"recommended_start":start,"recommended_end":end,"message":"Create a new proposal to preserve the auditable negotiation history."}

@app.get("/notifications")
def get_notifications(db=Depends(get_db),current_user:User=Depends(get_current_user)):
    return [dict(r) for r in db.execute(text("SELECT * FROM notifications WHERE recipient_user_id=:id ORDER BY created_at DESC"),{"id":current_user.user_id}).mappings()]
@app.get("/notifications/unread-count")
def unread_notifications(db=Depends(get_db),current_user:User=Depends(get_current_user)):
    return {"count":db.execute(text("SELECT count(*) FROM notifications WHERE recipient_user_id=:id AND read_at IS NULL"),{"id":current_user.user_id}).scalar()}
@app.post("/notifications/{notification_id}/read")
def read_notification(notification_id:str,db=Depends(get_db),current_user:User=Depends(get_current_user)):
    db.execute(text("UPDATE notifications SET read_at=now() WHERE id=:n AND recipient_user_id=:u"),{"n":notification_id,"u":current_user.user_id});db.commit();return {"ok":True}
@app.post("/notifications/read-all")
def read_all_notifications(db=Depends(get_db),current_user:User=Depends(get_current_user)):
    db.execute(text("UPDATE notifications SET read_at=now() WHERE recipient_user_id=:u AND read_at IS NULL"),{"u":current_user.user_id});db.commit();return {"ok":True}

# --- Same-department internal project grouping ------------------------------
def internal_group_members(db, group_id):
    ids = db.execute(text("SELECT project_id FROM project_group_projects WHERE group_id=:g AND removed_at IS NULL"), {"g":group_id}).scalars().all()
    return db.query(Project).filter(Project.project_id.in_(ids)).all()

def internal_group_analysis(projects, db):
    if len(projects) < 2: return {"feasible":False,"hard_blockers":["Select at least two source projects."],"reasons":[],"warnings":[]}
    start, end = max(p.start_date for p in projects), min(p.end_date for p in projects)
    blockers, warnings, reasons, scores = [], [], [], []
    for index, left in enumerate(projects):
        for right in projects[index+1:]:
            pair = coordination_pair_analysis(left,right,db)
            blockers.extend(pair["hard_blockers"]); warnings.extend(pair["warnings"]); scores.append(pair["coordination_score"]["score"])
    if start > end: blockers.append("No common execution window exists across all selected source projects.")
    else: reasons.append(f"All source projects share a feasible window from {start} to {end}.")
    score = 0 if blockers else round(sum(scores)/len(scores)) if scores else 0
    level = "VERY_HIGH" if score >= 85 else "HIGH" if score >=70 else "MODERATE" if score >=45 else "LOW"
    return {"feasible":not blockers,"recommended_start":start if start<=end else None,"recommended_end":end if start<=end else None,"grouping_score":score,"grouping_level":level,"hard_blockers":list(dict.fromkeys(blockers)),"reasons":list(dict.fromkeys(reasons)),"warnings":list(dict.fromkeys(warnings))}

def group_view_internal(db, group_id):
    group=db.execute(text("SELECT g.*, ST_AsGeoJSON(g.geometry)::json geometry_geojson, ST_AsGeoJSON(g.excavation_geometry)::json excavation_geojson FROM project_groups g WHERE id=:id"),{"id":group_id}).mappings().first()
    if not group: raise HTTPException(status_code=404,detail="Project group not found")
    return {"group":dict(group),"source_projects":[serialize_project(p) for p in internal_group_members(db,group_id)]}

def refresh_group_geometry(db, group_id):
    db.execute(text("""UPDATE project_groups SET geometry=(SELECT ST_Union(p.geometry) FROM projects p JOIN project_group_projects gp ON gp.project_id=p.project_id WHERE gp.group_id=:g AND gp.removed_at IS NULL),
      excavation_geometry=(SELECT ST_Union(p.excavation_geometry) FROM projects p JOIN project_group_projects gp ON gp.project_id=p.project_id WHERE gp.group_id=:g AND gp.removed_at IS NULL), updated_at=now() WHERE id=:g"""),{"g":group_id})

@app.get("/projects/{project_id}/internal-grouping-opportunities")
def internal_grouping_opportunities(project_id:str,db=Depends(get_db),current_user:User=Depends(get_current_user)):
    project=db.query(Project).filter(Project.project_id==project_id).first()
    if not project: raise HTTPException(status_code=404,detail="Project not found")
    candidates=db.query(Project).filter(Project.project_id!=project.project_id,Project.department_id==project.department_id,Project.status.notin_(["Rejected","Cancelled","Completed"])).all()
    result=[]
    for candidate in candidates:
        analysis=coordination_pair_analysis(project,candidate,db)
        if analysis["recommendation"] not in {"DO_NOT_COORDINATE","INDEPENDENT"}:
            result.append({"project_id":str(candidate.project_id),"project":serialize_project(candidate),"shared_corridor_m":analysis["checks"]["spatial"]["shared_corridor_m"],"common_window_feasible":bool(analysis["checks"]["temporal"]["common_window"]),"grouping_score":analysis["coordination_score"]["score"],"grouping_level":analysis["coordination_score"]["level"],"recommendation":"GROUP" if analysis["recommendation"]=="COORDINATE" else "GROUP_WITH_REVIEW","reasons":analysis["reasons"],"warnings":analysis["warnings"]})
    return {"project_id":project_id,"department":project.department_id,"opportunities":sorted(result,key=lambda item:item["grouping_score"],reverse=True)}

@app.post("/project-groups")
def create_internal_group(payload:ProjectGroupCreate,db=Depends(get_db),current_user:User=Depends(get_current_user)):
    ids=list(dict.fromkeys(payload.project_ids)); projects=db.query(Project).filter(Project.project_id.in_(ids)).all()
    if len(ids)<2 or len(projects)!=len(ids): raise HTTPException(status_code=422,detail="Select two or more valid source projects")
    if any(p.department_id!=current_user.department for p in projects) and current_user.role!="Super Admin": raise HTTPException(status_code=403,detail="Internal groups may contain only your department's projects")
    if len(set(p.department_id for p in projects))!=1: raise HTTPException(status_code=422,detail="Internal grouping requires one department")
    analysis=internal_group_analysis(projects,db)
    if not analysis["feasible"]: raise HTTPException(status_code=422,detail={"message":"The selected group is infeasible.","hard_blockers":analysis["hard_blockers"]})
    gid=str(uuid.uuid4()); code=f"PG-{datetime.now().strftime('%y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    db.execute(text("""INSERT INTO project_groups (id,group_code,department_id,name,description,urgency,recommended_start,recommended_end,final_start,final_end,excavation_width_m,excavation_depth_m,estimated_cost,estimated_excavation_cost,estimated_restoration_cost,estimated_traffic_management_cost,grouping_score,grouping_level,estimated_savings,estimated_disruption_reduction,created_by,last_analyzed_at)
    VALUES (:id,:code,:department,:name,:description,:urgency,:start,:end,:start,:end,:width,:depth,:cost,:exc,:rest,:traffic,:score,:level,:savings,:reduction,:user,now())"""),{"id":gid,"code":code,"department":projects[0].department_id,"name":payload.name or f"Consolidated {projects[0].department_id.title()} Works","description":payload.description,"urgency":"Emergency" if any(p.urgency=="Emergency" for p in projects) else "Urgent" if any(p.urgency=="Urgent" for p in projects) else "Planned","start":analysis["recommended_start"],"end":analysis["recommended_end"],"width":max(float(p.excavation_width_m or 0) for p in projects),"depth":max(float(p.excavation_depth_m or 0) for p in projects),"cost":sum(float(p.estimated_cost or 0) for p in projects),"exc":sum(float(p.excavation_cost or 0) for p in projects),"rest":sum(float(p.restoration_cost or 0) for p in projects),"traffic":sum(float(p.traffic_management_cost or 0) for p in projects),"score":analysis["grouping_score"],"level":analysis["grouping_level"],"savings":sum(float(p.restoration_cost or 0) for p in projects[1:]),"reduction":len(projects)-1,"user":current_user.user_id})
    for index,p in enumerate(projects): db.execute(text("INSERT INTO project_group_projects (group_id,project_id,role) VALUES (:g,:p,:role)"),{"g":gid,"p":str(p.project_id),"role":"PRIMARY" if index==0 else "SECONDARY"});p.grouping_status="GROUPED"
    refresh_group_geometry(db,gid);audit(db,current_user.user_id,"GROUP_CREATED","project_group",gid,{"project_ids":ids,"analysis":analysis});db.commit();return group_view_internal(db,gid)

@app.get("/project-groups/{group_id}")
def get_internal_group(group_id:str,db=Depends(get_db),current_user:User=Depends(get_current_user)): return group_view_internal(db,group_id)

@app.patch("/project-groups/{group_id}")
def update_internal_group(group_id:str,payload:ProjectGroupUpdate,db=Depends(get_db),current_user:User=Depends(get_current_user)):
    group=db.execute(text("SELECT * FROM project_groups WHERE id=:id"),{"id":group_id}).mappings().first()
    if not group: raise HTTPException(status_code=404,detail="Project group not found")
    if group["department_id"]!=current_user.department and current_user.role!="Super Admin":raise HTTPException(status_code=403,detail="Only the owning department can update this group")
    changes=payload.model_dump(exclude_unset=True)
    if changes.get("final_start") and changes.get("final_end") and changes["final_end"]<changes["final_start"]:raise HTTPException(status_code=422,detail="Execution end must follow start")
    stale=any(key in changes for key in ("final_start","final_end","excavation_width_m","excavation_depth_m","urgency"))
    if changes:
        sets=", ".join(f"{key}=:{key}" for key in changes)+", updated_at=now()"+(", analysis_status='STALE'" if stale else "")
        db.execute(text(f"UPDATE project_groups SET {sets} WHERE id=:id"),{**changes,"id":group_id})
        audit(db,current_user.user_id,"GROUP_DETAILS_UPDATED","project_group",group_id,{"changes":changes,"analysis_stale":stale})
    db.commit();return group_view_internal(db,group_id)

@app.post("/project-groups/{group_id}/analyze")
def analyze_internal_group(group_id:str,db=Depends(get_db),current_user:User=Depends(get_current_user)):
    projects=internal_group_members(db,group_id);analysis=internal_group_analysis(projects,db)
    db.execute(text("UPDATE project_groups SET analysis_status=:state,status=:status,recommended_start=:start,recommended_end=:end,grouping_score=:score,grouping_level=:level,analysis_version=analysis_version+1,last_analyzed_at=now(),updated_at=now() WHERE id=:id"),{"state":"CURRENT" if analysis["feasible"] else "FAILED","status":"READY_FOR_REVIEW" if analysis["feasible"] else "DRAFT","start":analysis.get("recommended_start"),"end":analysis.get("recommended_end"),"score":analysis.get("grouping_score",0),"level":analysis.get("grouping_level","LOW"),"id":group_id});refresh_group_geometry(db,group_id);audit(db,current_user.user_id,"GROUP_ANALYSIS_COMPLETED","project_group",group_id,analysis);db.commit();return {**group_view_internal(db,group_id),"analysis":analysis}

@app.get("/project-groups/{group_id}/candidate-projects")
def group_candidate_projects(group_id:str,db=Depends(get_db),current_user:User=Depends(get_current_user)):
    group=db.execute(text("SELECT department_id FROM project_groups WHERE id=:id"),{"id":group_id}).mappings().first()
    if not group:raise HTTPException(status_code=404,detail="Project group not found")
    members=internal_group_members(db,group_id); member_ids={p.project_id for p in members}; candidates=db.query(Project).filter(Project.department_id==group["department_id"],Project.status.notin_(["Rejected","Cancelled","Completed"])).all(); result=[]
    for candidate in candidates:
        if candidate.project_id in member_ids:continue
        analysis=internal_group_analysis([*members,candidate],db)
        result.append({"project":serialize_project(candidate),"feasible":analysis["feasible"],"analysis":analysis})
    return sorted(result,key=lambda item:item["analysis"].get("grouping_score",0),reverse=True)

@app.post("/project-groups/{group_id}/projects")
def add_group_project(group_id:str,payload:GroupProjectAdd,db=Depends(get_db),current_user:User=Depends(get_current_user)):
    candidate=db.query(Project).filter(Project.project_id==payload.project_id).first(); members=internal_group_members(db,group_id)
    if not candidate:raise HTTPException(status_code=404,detail="Project not found")
    if candidate.department_id!=members[0].department_id:raise HTTPException(status_code=422,detail="Only same-department projects can be grouped")
    analysis=internal_group_analysis([*members,candidate],db)
    if not analysis["feasible"]:raise HTTPException(status_code=422,detail={"message":"Project cannot be added.","hard_blockers":analysis["hard_blockers"]})
    db.execute(text("INSERT INTO project_group_projects (group_id,project_id,role) VALUES (:g,:p,'SECONDARY')"),{"g":group_id,"p":str(candidate.project_id)});candidate.grouping_status="GROUPED";refresh_group_geometry(db,group_id);db.execute(text("UPDATE project_groups SET analysis_status='STALE',updated_at=now() WHERE id=:id"),{"id":group_id});audit(db,current_user.user_id,"GROUP_PROJECT_ADDED","project_group",group_id,{"project_id":str(candidate.project_id)});db.commit();return group_view_internal(db,group_id)

@app.delete("/project-groups/{group_id}/projects/{project_id}")
def remove_group_project(group_id:str,project_id:str,db=Depends(get_db),current_user:User=Depends(get_current_user)):
    members=internal_group_members(db,group_id)
    if len(members)<=2:raise HTTPException(status_code=422,detail="A consolidated project must retain at least two source projects")
    db.execute(text("UPDATE project_group_projects SET removed_at=now() WHERE group_id=:g AND project_id=:p"),{"g":group_id,"p":project_id});project=db.query(Project).filter(Project.project_id==project_id).first()
    if project:project.grouping_status="NONE"
    refresh_group_geometry(db,group_id);db.execute(text("UPDATE project_groups SET analysis_status='STALE',updated_at=now() WHERE id=:id"),{"id":group_id});audit(db,current_user.user_id,"GROUP_PROJECT_REMOVED","project_group",group_id,{"project_id":project_id});db.commit();return group_view_internal(db,group_id)

@app.post("/project-groups/{group_id}/submit")
def submit_internal_group(group_id:str,db=Depends(get_db),current_user:User=Depends(get_current_user)):
    group=db.execute(text("SELECT * FROM project_groups WHERE id=:id"),{"id":group_id}).mappings().first()
    if not group:raise HTTPException(status_code=404,detail="Project group not found")
    if group["analysis_status"]!="CURRENT":raise HTTPException(status_code=409,detail="Re-analyze the consolidated project before submission")
    db.execute(text("UPDATE project_groups SET status='SUBMITTED',updated_at=now() WHERE id=:id"),{"id":group_id});audit(db,current_user.user_id,"GROUP_SUBMITTED","project_group",group_id);db.commit();return group_view_internal(db,group_id)


UTILITY_TYPES = {"roads", "water", "sewage", "drainage", "natural-gas", "fibre"}

@app.get("/gis/geojson")
def gis_geojson(types: str | None = None, bbox: str | None = None, current_user: User = Depends(get_current_user)):
    """Return selected underground network records as a database-built GeoJSON FeatureCollection."""
    selected_types = None
    if types:
        selected_types = [value.strip() for value in types.split(",") if value.strip()]
        invalid_types = set(selected_types) - UTILITY_TYPES
        if invalid_types:
            raise HTTPException(status_code=422, detail=f"Unsupported utility type: {', '.join(sorted(invalid_types))}")

    bounds = None
    if bbox:
        try:
            bounds = [float(value) for value in bbox.split(",")]
        except ValueError as error:
            raise HTTPException(status_code=422, detail="bbox must be minLon,minLat,maxLon,maxLat") from error
        if len(bounds) != 4 or bounds[0] > bounds[2] or bounds[1] > bounds[3]:
            raise HTTPException(status_code=422, detail="bbox must be minLon,minLat,maxLon,maxLat")

    where_clauses = []
    parameters = []
    if selected_types:
        where_clauses.append("utility_type = ANY(%s)")
        parameters.append(selected_types)
    if bounds:
        where_clauses.append("geometry && ST_MakeEnvelope(%s, %s, %s, %s, 4326) AND ST_Intersects(geometry, ST_MakeEnvelope(%s, %s, %s, %s, 4326))")
        parameters.extend(bounds + bounds)
    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    query = f"""
        SELECT json_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(json_agg(json_build_object(
                'type', 'Feature',
                'id', id,
                'geometry', ST_AsGeoJSON(geometry)::json,
                'properties', properties || jsonb_build_object('utility_type', utility_type)
            )), '[]'::json)
        )
        FROM underground_networks
        {where_sql}
    """
    try:
        with psycopg2.connect(DATABASE_URL) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, parameters)
                return cursor.fetchone()[0]
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Unable to query GIS data: {error}") from error


@app.get("/db-version")
def db_version(current_user: User = Depends(get_current_user)):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        try:
            cur.execute("SELECT PostGIS_Version();")
            row = cur.fetchone()
            version = row[0] if row else None
        except Exception:
            cur.execute("SELECT version();")
            version = cur.fetchone()[0]
        cur.close()
        conn.close()
        return {"database": version}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
