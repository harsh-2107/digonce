CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS underground_networks (
    id BIGSERIAL PRIMARY KEY,
    utility_type TEXT NOT NULL CHECK (utility_type IN ('roads', 'water', 'sewage', 'drainage', 'natural-gas', 'fibre')),
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    geometry geometry(LineString, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS underground_networks_geometry_gix
    ON underground_networks USING GIST (geometry);
CREATE INDEX IF NOT EXISTS underground_networks_utility_type_idx
    ON underground_networks (utility_type);
