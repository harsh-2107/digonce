import { useState } from "react";
import { CalendarDays, MapPin, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useProjects } from "@/context/ProjectsContext";
import { TopNav } from "@/components/TopNav";
import { ProjectCardActions } from "@/components/ProjectCardActions";
import { ProjectDetailsModal } from "@/components/ProjectDetailsModal";
import { EditProjectModal } from "@/components/EditProjectModal";
import { PROJECT_STATUSES, PROJECT_TYPES } from "@/projectOptions";
import type { Project } from "@/context/ProjectsContext";
import "@/App.css";

const ALL_DEPARTMENTS = ["water", "sewage", "drainage", "natural-gas", "fibre"];

export function ProjectsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projects, loading, error, submitProject, updateProject, deleteProject, discardProject } = useProjects();
  const [detailsProject, setDetailsProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Default owning department filter to logged-in user's department
  const defaultDept = user?.department === "super-admin" ? "" : (user?.department ?? "");

  const [filters, setFilters] = useState({
    department: defaultDept,
    status: "",
    projectType: "",
    from: "",
    to: "",
  });

  const [sort, setSort] = useState({ by: "created_at", order: "desc" });

  if (!user) return null;

  const departments = Array.from(
    new Set([...ALL_DEPARTMENTS, ...projects.map((project) => project.department).filter(Boolean)])
  ).sort();

  const visible = projects.filter(
    (project) =>
      (!filters.department || project.department === filters.department) &&
      (!filters.status || project.status === filters.status) &&
      (!filters.projectType || project.project_type === filters.projectType) &&
      (!filters.from || project.start_date >= filters.from) &&
      (!filters.to || project.start_date <= filters.to)
  );

  const sorted = [...visible].sort((left, right) => {
    const leftValue = left[sort.by as keyof Pick<Project, "created_at" | "project_name" | "status" | "start_date" | "end_date" | "urgency">];
    const rightValue = right[sort.by as keyof Pick<Project, "created_at" | "project_name" | "status" | "start_date" | "end_date" | "urgency">];
    const compare = (leftValue ?? "").localeCompare(rightValue ?? "");
    return sort.order === "asc" ? compare : -compare;
  });

  const isOwner = (project: Project) => user.department === "super-admin" || project.department === user.department;

  const clearFilters = () => {
    setFilters({
      department: user.department === "super-admin" ? "" : user.department,
      status: "",
      projectType: "",
      from: "",
      to: "",
    });
  };

  async function removeProject(project: Project) {
    if (!window.confirm(`Delete ${project.project_name}? This cannot be undone.`)) return;
    setActionError(null); setActionMessage(null);
    try { await deleteProject(project.project_id); setDetailsProject(null); setActionMessage("Project permanently deleted."); }
    catch (err) { setActionError(err instanceof Error ? err.message : "Unable to delete project"); }
  }

  async function discard(project: Project) {
    const reason = window.prompt(`Why discard ${project.project_name}? (optional)`);
    if (reason === null || !window.confirm(`Discard ${project.project_name}? It will remain visible with its history.`)) return;
    setActionError(null); setActionMessage(null);
    try { await discardProject(project.project_id, reason || undefined); setDetailsProject(null); setActionMessage("Project discarded. Its details and history are retained."); }
    catch (err) { setActionError(err instanceof Error ? err.message : "Unable to discard project"); }
  }

  return (
    <main className="app-page">
      <TopNav />
      <section className="page-content">
        <div className="page-header">
          <div>
            <p className="eyebrow">PROJECT PIPELINE</p>
            <h1>Projects</h1>
            <p className="page-intro">
              Drafts and submitted excavation work from the live project API.
            </p>
          </div>
          <Link className="page-create" to="/projects/new">
            <Plus size={17} /> Create project
          </Link>
        </div>

        {(error || actionError) && <p className="form-error">{error || actionError}</p>}
        {actionMessage && <p className="page-intro">{actionMessage}</p>}

        <div className="project-toolbar" aria-label="Project filters and sorting">
          <div className="project-toolbar-heading">
            <strong>Filter projects</strong>
            <button className="text-button" onClick={clearFilters}>
              Clear filters
            </button>
          </div>

          <div className="project-filter-grid">
            <label>
              Owning department
              <select
                value={filters.department}
                onChange={(e) => setFilters({ ...filters, department: e.target.value })}
              >
                <option value="">All departments</option>
                {departments.map((department) => (
                  <option value={department!} key={department}>
                    {department!.replaceAll("-", " ")}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Status
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">All statuses</option>
                {PROJECT_STATUSES.map((status) => (
                  <option value={status} key={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Project type
              <select
                value={filters.projectType}
                onChange={(e) => setFilters({ ...filters, projectType: e.target.value })}
              >
                <option value="">All project types</option>
                {PROJECT_TYPES.map((type) => (
                  <option value={type} key={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Starts on/after
              <input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              />
            </label>

            <label>
              Starts on/before
              <input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              />
            </label>
          </div>

          <div className="project-sort">
            <span>Sort</span>
            <select value={sort.by} onChange={(e) => setSort({ ...sort, by: e.target.value })}>
              <option value="created_at">Created date</option>
              <option value="project_name">Project name</option>
              <option value="status">Status</option>
              <option value="start_date">Start date</option>
              <option value="end_date">End date</option>
              <option value="urgency">Priority</option>
            </select>
            <button
              className="secondary-button"
              onClick={() => setSort({ ...sort, order: sort.order === "asc" ? "desc" : "asc" })}
            >
              {sort.order === "asc" ? "Ascending" : "Descending"}
            </button>
          </div>
        </div>

        <div className="project-list">
          {loading ? (
            <div className="empty-state">Loading projects…</div>
          ) : sorted.length ? (
            sorted.map((project) => (
              <article className="project-card" key={project.project_id}>
                <div className="project-code">
                  {project.project_id.slice(0, 8).toUpperCase()}
                </div>
                <div className="project-body">
                  <div>
                    <h3>{project.project_name}</h3>
                    <p>{project.description}</p>
                  </div>
                  <div className="project-meta">
                    <span>
                      <MapPin size={14} />
                      {project.department?.replace("-", " ") ?? "Department"}
                    </span>
                    <span>
                      <CalendarDays size={14} />
                      {project.duration
                        ? `Tentative Start: ${project.start_date} · Duration: ${project.duration}`
                        : `${project.start_date} → ${project.end_date}`}
                    </span>
                  </div>
                  <p className="page-intro">Coordination: {project.coordination_status.replaceAll("_", " ")}</p>
                  {isOwner(project) && project.noc_summary && (
                    <p className="page-intro">
                      {project.noc_summary.all_cleared ? (
                        <span style={{ color: "var(--color-success, #22c55e)", fontWeight: 600 }}>
                          NOC: All cleared ✅
                        </span>
                      ) : (
                        <span>
                          NOC: {project.noc_summary.given} / {project.noc_summary.total} departments
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div className="project-status">
                  <span className="status-pill">{project.status.toLowerCase()}</span>
                  {project.status === "Draft" && isOwner(project) && (
                    <button
                      className="text-button"
                      onClick={() => void submitProject(project.project_id)}
                    >
                      Submit
                    </button>
                  )}
                  <ProjectCardActions
                    project={project}
                    onViewDetails={() => navigate(`/projects/${project.project_id}`)}
                  />
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state">No projects match these filters.</div>
          )}
        </div>
      </section>

      <ProjectDetailsModal
        project={detailsProject}
        onClose={() => setDetailsProject(null)}
        onEdit={
          detailsProject && isOwner(detailsProject)
            ? (project) => {
                setDetailsProject(null);
                setEditingProject(project);
              }
            : undefined
        }
        onDiscard={
          detailsProject && isOwner(detailsProject)
            ? (project) => void discard(project)
            : undefined
        }
        onDelete={
          detailsProject && isOwner(detailsProject)
            ? (project) => void removeProject(project)
            : undefined
        }
      />
      <EditProjectModal
        project={editingProject}
        onClose={() => setEditingProject(null)}
        onSave={async (id, values) => {
          await updateProject(id, values);
        }}
      />
    </main>
  );
}
