import os
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:5173", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Demo-only credentials. Move these to a database and store password hashes before deployment.
DEMO_USERS = {
    "admin@digonce.gov.in": {"password": "admin123", "name": "City Admin", "department": "super-admin", "role": "Super Admin"},
    "water@digonce.gov.in": {"password": "water123", "name": "Water Admin", "department": "water", "role": "Water Department Admin"},
    "sewage@digonce.gov.in": {"password": "sewage123", "name": "Sewage Admin", "department": "sewage", "role": "Sewage Department Admin"},
    "drainage@digonce.gov.in": {"password": "drainage123", "name": "Drainage Admin", "department": "drainage", "role": "Drainage Department Admin"},
    "gas@digonce.gov.in": {"password": "gas123", "name": "Gas Admin", "department": "natural-gas", "role": "Natural Gas Department Admin"},
    "fibre@digonce.gov.in": {"password": "fibre123", "name": "Fibre Admin", "department": "fibre", "role": "Fibre Department Admin"},
}


class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/auth/login")
def login(credentials: LoginRequest):
    user = DEMO_USERS.get(credentials.email.lower())
    if not user or user["password"] != credentials.password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return {key: value for key, value in user.items() if key != "password"}


@app.get("/auth/demo-accounts")
def demo_accounts():
    """Names and roles for the frontend's demo-account picker; passwords are never returned."""
    return [
        {"email": email, **{key: value for key, value in user.items() if key != "password"}}
        for email, user in DEMO_USERS.items()
    ]

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/postgres")
UTILITY_TYPES = {"roads", "water", "sewage", "drainage", "natural-gas", "fibre"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/gis/geojson")
def gis_geojson(types: str | None = None, bbox: str | None = None):
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
def db_version():
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
