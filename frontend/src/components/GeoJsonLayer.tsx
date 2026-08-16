import { useEffect, useRef } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import type { FeatureCollection } from "geojson";

export function GeoJsonLayer({
  data,
  color,
  label,
}: {
  data: FeatureCollection;
  color: string;
  label: string;
}) {
  const geoJsonRef = useRef<any>(null);
  const map = useMap();

  useEffect(() => {
    if (geoJsonRef.current && map) {
      try {
        const bounds = geoJsonRef.current.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      } catch (error) {
        console.error("Error fitting bounds:", error);
      }
    }
  }, [data, map]);

  return (
    <GeoJSON
      ref={geoJsonRef}
      data={data}
      style={{ color, weight: 5, opacity: 0.9 }}
      onEachFeature={(feature, layer) => {
        const properties = feature.properties ?? {};
        const details =
          Object.entries(properties)
            .filter(([key]) => key !== "utility_type")
            .map(([key, value]) => `${key}: ${value}`)
            .join("<br/>") || "Dig Once Nagpur network data";
        layer.bindPopup(`<b>${label}</b><br/>${details}`);
      }}
    />
  );
}
