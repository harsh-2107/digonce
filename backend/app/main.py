import os
from fastapi import FastAPI, HTTPException
import psycopg2

app = FastAPI()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/postgres")


@app.get("/health")
def health():
    return {"status": "ok"}


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
