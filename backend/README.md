FastAPI backend

Environment variables: copy `.env.example` to `.env` or set `DATABASE_URL`.

Run locally (Python required):

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## GIS data import

Store each network dataset in `backend/data` using these names:

`roads.geojson`, `water.geojson`, `sewage.geojson`, `drainage.geojson`, `natural-gas.geojson`, and `fibre.geojson`.

All LineString and MultiLineString features are imported into PostGIS table
`underground_networks` as `geometry(LineString, 4326)`, retaining GeoJSON
properties in `properties` and the dataset name in `utility_type`.

Run the reproducible import after adding or replacing source files:

```bash
python scripts/import_gis.py --replace
```

Docker Compose performs this import on backend startup. Query the data as a
GeoJSON FeatureCollection with `GET /gis/geojson`, optionally using
`?types=water,sewage` and `&bbox=minLon,minLat,maxLon,maxLat`.
