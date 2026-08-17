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
import { PROJECT_PRIORITIES, PROJECT_TYPES } from "@/projectOptions";
import "leaflet/dist/leaflet.css";
import "@/App.css";
type Point = [number, number];
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
    duration: "10 - 12 days",
    excavation_width_m: "",
    excavation_depth_m: "",
    estimated_cost: "",
    contractor_name: "",
  });
  const [customDurationVal, setCustomDurationVal] = useState("");
  const [customDurationUnit, setCustomDurationUnit] = useState("Days");
  const [points, setPoints] = useState<Point[]>([]);
  const length = useMemo(() => corridorLength(points), [points]);
  if (!user) return null;
  const ownLayer = layers[user.department as UtilityType];
  const relevantProjects = projects.filter(
    (project) => project.department === user.department,
  );
  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const next = () => {
    if (step === 1 && points.length < 2)
      return setError("Draw a work corridor with at least two points.");
    if (step === 2 && (!form.project_name || !form.description))
      return setError("Add a project name and work description.");
    if (step === 3) {
      if (!form.start_date || !form.duration)
        return setError("Select a tentative start date and duration.");
      if (form.duration === "Custom") {
        const num = Number(customDurationVal);
        if (!customDurationVal || isNaN(num) || num <= 0)
          return setError("Enter a valid custom duration greater than 0.");
      }
    }
    if (
      step === 4 &&
      (!form.excavation_width_m || Number(form.excavation_width_m) <= 0)
    )
      return setError("Excavation width must be greater than zero.");
    setError(null);
    setStep((current) => Math.min(4, current + 1));
  };
  async function saveDraft(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const nullable = (value: string) => (value === "" ? null : Number(value));
      const finalDuration =
        form.duration === "Custom"
          ? `${customDurationVal.trim()} ${customDurationUnit.toLowerCase()}`
          : form.duration;
      const project = await createProject({
        ...form,
        start_date: form.start_date,
        duration: finalDuration,
        end_date: null,
        excavation_width_m: Number(form.excavation_width_m),
        excavation_depth_m: nullable(form.excavation_depth_m),
        estimated_cost: nullable(form.estimated_cost),
        excavation_cost: null,
        restoration_cost: null,
        traffic_management_cost: null,
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
                      {PROJECT_TYPES.map((type) => (
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
                      {PROJECT_PRIORITIES.map((value) => (
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
                  Tentative start date
                  <input
                    required
                    type="date"
                    value={form.start_date}
                    onChange={(e) => update("start_date", e.target.value)}
                  />
                </label>
                <label>
                  Duration
                  <select
                    value={form.duration}
                    onChange={(e) => update("duration", e.target.value)}
                  >
                    <option value="1 - 2 days">1 - 2 days</option>
                    <option value="3 - 5 days">3 - 5 days</option>
                    <option value="5 - 7 days">5 - 7 days</option>
                    <option value="10 - 12 days">10 - 12 days</option>
                    <option value="1 - 2 weeks">1 - 2 weeks</option>
                    <option value="2 - 3 weeks">2 - 3 weeks</option>
                    <option value="1 - 2 months">1 - 2 months</option>
                    <option value="2 - 3 months">2 - 3 months</option>
                    <option value="Custom">Custom</option>
                  </select>
                </label>
              </div>
              {form.duration === "Custom" && (
                <div className="date-fields" style={{ marginTop: "1rem" }}>
                  <label>
                    Custom duration
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 15"
                      value={customDurationVal}
                      onChange={(e) => setCustomDurationVal(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Unit
                    <select
                      value={customDurationUnit}
                      onChange={(e) => setCustomDurationUnit(e.target.value)}
                    >
                      <option value="Days">Days</option>
                      <option value="Weeks">Weeks</option>
                      <option value="Months">Months</option>
                    </select>
                  </label>
                </div>
              )}
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
                <div className="date-fields">
                  <label>
                    Estimated cost
                    <input
                      type="number"
                      min="0"
                      value={form.estimated_cost}
                      onChange={(e) => update("estimated_cost", e.target.value)}
                    />
                  </label>
                  <label>
                    Contractor
                    <input
                      value={form.contractor_name}
                      onChange={(e) => update("contractor_name", e.target.value)}
                    />
                  </label>
                </div>
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
