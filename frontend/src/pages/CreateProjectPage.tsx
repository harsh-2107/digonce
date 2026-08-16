import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { CircleDollarSign, MapPin, Route } from "lucide-react";
import {
  GeoJSON,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useGis } from "@/context/GisContext";
import type { UtilityType } from "@/context/GisContext";
import { useProjects } from "@/context/ProjectsContext";
import { TopNav } from "@/components/TopNav";
import "leaflet/dist/leaflet.css";
import "@/App.css";
type Point = [number, number];
const types = [
  "New Installation",
  "Repair",
  "Replacement",
  "Maintenance",
  "Expansion / Extension",
  "Rehabilitation",
];
const colours: Record<UtilityType, string> = {
  roads: "#6b7280",
  water: "#2383d5",
  sewage: "#8257d3",
  drainage: "#e09b16",
  "natural-gas": "#e05d48",
  fibre: "#14a683",
};
const rad = (value: number) => (value * Math.PI) / 180;
const corridorLength = (points: Point[]) =>
  points.slice(1).reduce((total, point, index) => {
    const [a, b] = [points[index], point];
    const x = rad(b[1] - a[1]) * Math.cos(rad((a[0] + b[0]) / 2));
    const y = rad(b[0] - a[0]);
    return total + Math.sqrt(x * x + y * y) * 6371000;
  }, 0);
function CorridorDrawer({
  points,
  setPoints,
}: {
  points: Point[];
  setPoints: (points: Point[]) => void;
}) {
  useMapEvents({
    click: (event) =>
      setPoints([...points, [event.latlng.lat, event.latlng.lng]]),
  });
  return (
    <>
      {points.map((point, index) => (
        <Marker
          draggable
          key={`${point[0]}-${index}`}
          position={point}
          eventHandlers={{
            dragend: (event) => {
              const position = event.target.getLatLng();
              setPoints(
                points.map((current, i) =>
                  i === index ? [position.lat, position.lng] : current,
                ),
              );
            },
          }}
        />
      ))}
      {points.length > 1 && (
        <Polyline
          positions={points}
          pathOptions={{ color: "#087e8b", weight: 6 }}
        />
      )}
    </>
  );
}
function FitNetwork({ data }: { data: GeoJSON.FeatureCollection | undefined }) {
  const map = useMap();
  useEffect(() => {
    const coordinates =
      data?.features.flatMap((feature) =>
        feature.geometry?.type === "LineString"
          ? feature.geometry.coordinates
          : [],
      ) ?? [];
    if (coordinates.length) {
      const latitudes = coordinates.map(([, lat]) => lat);
      const longitudes = coordinates.map(([lng]) => lng);
      map.fitBounds(
        [
          [Math.min(...latitudes), Math.min(...longitudes)],
          [Math.max(...latitudes), Math.max(...longitudes)],
        ],
        { padding: [35, 35] },
      );
    }
  }, [data, map]);
  return null;
}
export function CreateProjectPage() {
  const { user } = useAuth();
  const { layers } = useGis();
  const { createProject, submitProject, projects } = useProjects();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    project_name: "",
    project_type: "Replacement",
    description: "",
    urgency: "Planned",
    start_date: "",
    end_date: "",
    excavation_width_m: "",
    excavation_depth_m: "",
    estimated_cost: "",
    excavation_cost: "",
    restoration_cost: "",
    traffic_management_cost: "",
    contractor_name: "",
  });
  const [points, setPoints] = useState<Point[]>([]);
  const length = useMemo(() => corridorLength(points), [points]);
  const duration =
    form.start_date && form.end_date
      ? Math.floor(
          (Date.parse(`${form.end_date}T00:00:00`) -
            Date.parse(`${form.start_date}T00:00:00`)) /
            86400000,
        ) + 1
      : null;
  if (!user) return null;
  const ownLayer = layers[user.department as UtilityType];
  const relevantProjects = projects.filter(
    (project) => project.department === user.department,
  );
  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const next = () => {
    const costs = [
      "excavation_cost",
      "restoration_cost",
      "traffic_management_cost",
    ].reduce(
      (total, key) => total + Number(form[key as keyof typeof form] || 0),
      0,
    );
    if (step === 1 && points.length < 2)
      return setError("Draw a work corridor with at least two points.");
    if (step === 2 && (!form.project_name || !form.description))
      return setError("Add a project name and work description.");
    if (step === 3 && (!duration || duration < 1))
      return setError(
        "Planned end date must be on or after planned start date.",
      );
    if (
      step === 4 &&
      (!form.excavation_width_m || Number(form.excavation_width_m) <= 0)
    )
      return setError("Excavation width must be greater than zero.");
    if (form.estimated_cost && Number(form.estimated_cost) < costs)
      return setError(
        "Estimated cost must cover excavation, restoration, and traffic management costs.",
      );
    setError(null);
    setStep((current) => Math.min(4, current + 1));
  };
  async function saveDraft(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const nullable = (value: string) => (value === "" ? null : Number(value));
      const project = await createProject({
        ...form,
        excavation_width_m: Number(form.excavation_width_m),
        excavation_depth_m: nullable(form.excavation_depth_m),
        estimated_cost: nullable(form.estimated_cost),
        excavation_cost: nullable(form.excavation_cost),
        restoration_cost: nullable(form.restoration_cost),
        traffic_management_cost: nullable(form.traffic_management_cost),
        contractor_name: form.contractor_name || null,
        geometry: {
          type: "LineString",
          coordinates: points.map(([lat, lng]) => [lng, lat]),
        },
      });
      setCreatedId(project.project_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save draft");
    } finally {
      setSaving(false);
    }
  }
  async function submit() {
    if (!createdId) return;
    setSaving(true);
    try {
      const project = await submitProject(createdId);
      navigate(`/projects/${project.project_id}/analysis`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit project");
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="app-page">
      <TopNav />
      <section className="page-content create-project-page">
        <p className="eyebrow">{user.department.toUpperCase()} DEPARTMENT</p>
        <h1>Create excavation project</h1>
        <p className="page-intro">Start by drawing the actual work corridor.</p>
        <div className="workflow-steps">
          {[
            "Location",
            "Project information",
            "Schedule",
            "Work parameters",
          ].map((label, index) => (
            <span
              className={
                step === index + 1
                  ? "current"
                  : step > index + 1
                    ? "complete"
                    : ""
              }
              key={label}
            >
              {index + 1}. {label}
            </span>
          ))}
        </div>
        {createdId ? (
          <div className="draft-success">
            <h2>Draft saved</h2>
            <p>Submit the project.</p>
            <button
              className="submit-project"
              onClick={submit}
              disabled={saving}
            >
              Submit for review
            </button>
          </div>
        ) : (
          <form className="project-form" onSubmit={saveDraft}>
            {step === 1 && (
              <>
                <div className="map-draw-note">
                  <Route size={18} />
                  <span>
                    Click to add points, drag markers to edit, or remove the
                    last point. Your {user.department.replace("-", " ")} network
                    is highlighted.
                  </span>
                </div>
                <MapContainer
                  center={[21.1458, 79.0882]}
                  zoom={13}
                  className="corridor-map"
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <FitNetwork data={ownLayer} />
                  {layers.roads && (
                    <GeoJSON
                      data={layers.roads}
                      style={{ color: colours.roads, weight: 3, opacity: 0.7 }}
                    />
                  )}{" "}
                  {ownLayer && (
                    <GeoJSON
                      data={ownLayer}
                      style={{
                        color: colours[user.department as UtilityType],
                        weight: 6,
                        opacity: 1,
                      }}
                    />
                  )}{" "}
                  {relevantProjects.map((project) => (
                    <GeoJSON
                      key={project.project_id}
                      data={project.geometry}
                      style={{ color: "#64748b", weight: 3, dashArray: "7 6" }}
                    />
                  ))}
                  <CorridorDrawer points={points} setPoints={setPoints} />
                </MapContainer>
                <div className="corridor-actions">
                  <span>
                    <MapPin size={15} />
                    Work corridor length: {length.toFixed(0)} m
                  </span>
                  <div>
                    <button
                      type="button"
                      onClick={() => setPoints(points.slice(0, -1))}
                      disabled={!points.length}
                    >
                      Remove last
                    </button>
                    <button type="button" onClick={() => setPoints([])}>
                      Clear
                    </button>
                  </div>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <label>
                  Project name
                  <input
                    required
                    value={form.project_name}
                    onChange={(e) => update("project_name", e.target.value)}
                  />
                </label>
                <div className="date-fields">
                  <label>
                    Project type
                    <select
                      value={form.project_type}
                      onChange={(e) => update("project_type", e.target.value)}
                    >
                      {types.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Urgency
                    <select
                      value={form.urgency}
                      onChange={(e) => update("urgency", e.target.value)}
                    >
                      {["Planned", "Urgent", "Emergency"].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Department
                  <input value={user.department.replace("-", " ")} disabled />
                </label>
                <label>
                  Description
                  <textarea
                    required
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                    rows={4}
                  />
                </label>
              </>
            )}
            {step === 3 && (
              <>
                <div className="date-fields">
                  <label>
                    Planned start date
                    <input
                      required
                      type="date"
                      value={form.start_date}
                      onChange={(e) => update("start_date", e.target.value)}
                    />
                  </label>
                  <label>
                    Planned end date
                    <input
                      required
                      type="date"
                      value={form.end_date}
                      onChange={(e) => update("end_date", e.target.value)}
                    />
                  </label>
                </div>
                <p className="calculated-value">
                  Project duration:{" "}
                  {duration && duration > 0
                    ? `${duration} days`
                    : "Not calculated"}
                </p>
              </>
            )}
            {step === 4 && (
              <>
                <div className="date-fields">
                  <label>
                    Excavation width (m)
                    <input
                      required
                      min="0.1"
                      step="0.1"
                      type="number"
                      value={form.excavation_width_m}
                      onChange={(e) =>
                        update("excavation_width_m", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Excavation depth (m)
                    <input
                      min="0"
                      step="0.1"
                      type="number"
                      value={form.excavation_depth_m}
                      onChange={(e) =>
                        update("excavation_depth_m", e.target.value)
                      }
                    />
                  </label>
                </div>
                <div className="cost-grid">
                  {[
                    ["estimated_cost", "Estimated cost"],
                    ["excavation_cost", "Excavation cost"],
                    ["restoration_cost", "Restoration cost"],
                    ["traffic_management_cost", "Traffic management cost"],
                  ].map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        type="number"
                        min="0"
                        value={form[key as keyof typeof form]}
                        onChange={(e) =>
                          update(key as keyof typeof form, e.target.value)
                        }
                      />
                    </label>
                  ))}
                </div>
                <label>
                  Contractor
                  <input
                    value={form.contractor_name}
                    onChange={(e) => update("contractor_name", e.target.value)}
                  />
                </label>
              </>
            )}
            {error && <p className="form-error">{error}</p>}
            <div className="workflow-actions">
              {step > 1 && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setStep(step - 1)}
                >
                  Back
                </button>
              )}
              {step < 4 ? (
                <button type="button" className="submit-project" onClick={next}>
                  Continue
                </button>
              ) : (
                <button className="submit-project" disabled={saving}>
                  <CircleDollarSign size={17} />
                  {saving ? "Saving draft…" : "Save draft"}
                </button>
              )}
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
