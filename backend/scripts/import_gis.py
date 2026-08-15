"""Reproducibly import backend/data/<utility>.geojson into PostGIS.

Usage (from backend container): python scripts/import_gis.py --replace
"""
import argparse
import json
import os
from pathlib import Path

import psycopg2
from psycopg2.extras import Json

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/postgres")
BACKEND_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BACKEND_DIR / "data"
SCHEMA_FILE = BACKEND_DIR / "sql" / "001_gis.sql"
UTILITY_TYPES = ("roads", "water", "sewage", "drainage", "natural-gas", "fibre")


def line_strings(geometry):
    """Yield LineString geometries, expanding GeoJSON MultiLineStrings."""
    if not geometry:
        return
    if geometry["type"] == "LineString":
        yield geometry
    elif geometry["type"] == "MultiLineString":
        for coordinates in geometry["coordinates"]:
            yield {"type": "LineString", "coordinates": coordinates}


def import_dataset(cursor, utility_type, path, replace):
    if replace:
        cursor.execute("DELETE FROM underground_networks WHERE utility_type = %s", (utility_type,))
    document = json.loads(path.read_text())
    imported = 0
    for feature in document.get("features", []):
        properties = feature.get("properties") or {}
        for geometry in line_strings(feature.get("geometry")):
            cursor.execute(
                """
                INSERT INTO underground_networks (utility_type, properties, geometry)
                VALUES (%s, %s, ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326))
                """,
                (utility_type, Json(properties), json.dumps(geometry)),
            )
            imported += 1
    return imported


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--replace", action="store_true", help="replace already imported records for each dataset")
    args = parser.parse_args()
    with psycopg2.connect(DATABASE_URL) as connection:
        with connection.cursor() as cursor:
            cursor.execute(SCHEMA_FILE.read_text())
            for utility_type in UTILITY_TYPES:
                path = DATA_DIR / f"{utility_type}.geojson"
                if not path.exists():
                    print(f"Skipping {utility_type}: {path.name} not found")
                    continue
                count = import_dataset(cursor, utility_type, path, args.replace)
                print(f"Imported {count} {utility_type} line features")


if __name__ == "__main__":
    main()
