import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Feature, FeatureCollection, GeoJsonObject } from "geojson";
import { API_BASE, authHeaders } from "@/context/AuthContext";

export type UtilityType =
  | "roads"
  | "water"
  | "sewage"
  | "drainage"
  | "natural-gas"
  | "fibre";
export type NetworkLayers = Partial<Record<UtilityType, FeatureCollection>>;
type Bounds = [number, number, number, number];
type GisContextValue = {
  layers: NetworkLayers;
  loading: boolean;
  error: string | null;
  loadLayers: (bounds?: Bounds) => Promise<void>;
};
const GisContext = createContext<GisContextValue | undefined>(undefined);
const utilityTypes: UtilityType[] = [
  "roads",
  "water",
  "sewage",
  "drainage",
  "natural-gas",
  "fibre",
];

function splitLayers(collection: FeatureCollection): NetworkLayers {
  return collection.features.reduce<NetworkLayers>((layers, feature) => {
    const utilityType = feature.properties?.utility_type as
      | UtilityType
      | undefined;
    if (!utilityType || !utilityTypes.includes(utilityType)) return layers;
    const current = layers[utilityType] ?? {
      type: "FeatureCollection",
      features: [],
    };
    current.features.push(feature as Feature);
    layers[utilityType] = current;
    return layers;
  }, {});
}

export function GisProvider({ children }: { children: ReactNode }) {
  const [layers, setLayers] = useState<NetworkLayers>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  async function loadLayers(bounds?: Bounds) {
    setLoading(true);
    setError(null);
    try {
      const parameters = new URLSearchParams();
      if (bounds) parameters.set("bbox", bounds.join(","));
      const response = await fetch(
        `${API_BASE}/gis/geojson${parameters.size ? `?${parameters}` : ""}`,
        { headers: authHeaders() },
      );
      if (!response.ok)
        throw new Error("Unable to load underground network data.");
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json"))
        throw new Error(
          "GIS API returned HTML instead of GeoJSON. Restart the frontend development server to refresh its proxy configuration.",
        );
      const data: GeoJsonObject = await response.json();
      if (data.type !== "FeatureCollection")
        throw new Error("GIS endpoint did not return a FeatureCollection.");
      setLayers(splitLayers(data as FeatureCollection));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load underground network data.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void loadLayers();
  }, []);
  return (
    <GisContext.Provider value={{ layers, loading, error, loadLayers }}>
      {children}
    </GisContext.Provider>
  );
}
export function useGis() {
  const context = useContext(GisContext);
  if (!context) throw new Error("useGis must be used inside GisProvider");
  return context;
}
