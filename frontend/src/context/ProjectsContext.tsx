import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { API_BASE, useAuth } from "@/context/AuthContext";

export type Project = {
  project_id: string;
  project_name: string;
  description: string | null;
  department: string | null;
  project_type: string;
  urgency: string;
  status: string;
  start_date: string;
  end_date: string;
  corridor_length_m: number | null;
  duration_days: number | null;
  estimated_cost: number | null;
  excavation_cost: number | null;
  restoration_cost: number | null;
  traffic_management_cost: number | null;
  excavation_width_m: number;
  excavation_depth_m: number | null;
  contractor_name: string | null;
  geometry: GeoJSON.LineString;
  excavation_geometry: GeoJSON.Polygon | null;
  risk_level: string;
  coordination_opportunity: string;
};
export type NewProject = Omit<
  Project,
  | "project_id"
  | "status"
  | "department"
  | "excavation_geometry"
  | "corridor_length_m"
  | "duration_days"
  | "risk_level"
  | "coordination_opportunity"
>;
type ProjectsContextValue = {
  projects: Project[];
  loading: boolean;
  error: string | null;
  createProject: (project: NewProject) => Promise<Project>;
  submitProject: (id: string) => Promise<Project>;
  updateProject: (id: string, project: Partial<NewProject>) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
};
const ProjectsContext = createContext<ProjectsContextValue | undefined>(
  undefined,
);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const token = sessionStorage.getItem("dig-once-token");
      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail ?? "Unable to complete the request");
      }
      return response.json();
    },
    [],
  );
  const refreshProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setProjects(await request("/projects"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load projects");
    } finally {
      setLoading(false);
    }
  }, [request, user]);
  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);
  const createProject = async (project: NewProject) => {
    const created = await request("/projects", {
      method: "POST",
      body: JSON.stringify(project),
    });
    setProjects((current) => [created, ...current]);
    return created;
  };
  const submitProject = async (id: string) => {
    const submitted = await request(`/projects/${id}/submit`, {
      method: "POST",
    });
    setProjects((current) =>
      current.map((project) =>
        project.project_id === id ? submitted : project,
      ),
    );
    return submitted;
  };
  const updateProject = async (id: string, project: Partial<NewProject>) => {
    const updated = await request(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(project) });
    setProjects((current) => current.map((item) => item.project_id === id ? updated : item));
    return updated;
  };
  const deleteProject = async (id: string) => {
    await request(`/projects/${id}`, { method: "DELETE" });
    setProjects((current) => current.filter((item) => item.project_id !== id));
  };
  return (
    <ProjectsContext.Provider
      value={{
        projects,
        loading,
        error,
        createProject,
        submitProject,
        updateProject,
        deleteProject,
        refreshProjects,
      }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}
export function useProjects() {
  const context = useContext(ProjectsContext);
  if (!context)
    throw new Error("useProjects must be used inside ProjectsProvider");
  return context;
}
