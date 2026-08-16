import { useState } from "react";
import { CalendarDays, MapPin, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useProjects } from "@/context/ProjectsContext";
import { TopNav } from "@/components/TopNav";
import { ProjectCardActions } from "@/components/ProjectCardActions";
import { ProjectDetailsModal } from "@/components/ProjectDetailsModal";
import { EditProjectModal } from "@/components/EditProjectModal";
import type { Project } from "@/context/ProjectsContext";
import "@/App.css";
export function ProjectsPage() {
  const { user } = useAuth();
  const { projects, loading, error, submitProject, updateProject, deleteProject } = useProjects();
  const [detailsProject, setDetailsProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  if (!user) return null;
  const visible =
    user.department === "super-admin"
      ? projects
      : projects.filter((project) => project.department === user.department);
  async function removeProject(project: Project) {
    if (!window.confirm(`Delete ${project.project_name}? This cannot be undone.`)) return;
    setActionError(null);
    try { await deleteProject(project.project_id); setDetailsProject(null); }
    catch (err) { setActionError(err instanceof Error ? err.message : "Unable to delete project"); }
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
        <div className="project-list">
          {loading ? (
            <div className="empty-state">Loading projects…</div>
          ) : visible.length ? (
            visible.map((project) => (
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
                      {project.start_date} → {project.end_date}
                    </span>
                  </div>
                </div>
                <div className="project-status">
                  <span className="status-pill">
                    {project.status.toLowerCase()}
                  </span>
                  {project.status === "Draft" && (
                    <button
                      className="text-button"
                      onClick={() => void submitProject(project.project_id)}
                    >
                      Submit
                    </button>
                  )}
                  <ProjectCardActions project={project} onViewDetails={() => setDetailsProject(project)} />
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state">
              No projects have been created for your department yet.
            </div>
          )}
        </div>
      </section>
      <ProjectDetailsModal project={detailsProject} onClose={() => setDetailsProject(null)} onEdit={(project) => { setDetailsProject(null); setEditingProject(project); }} onDelete={(project) => void removeProject(project)} />
      <EditProjectModal project={editingProject} onClose={() => setEditingProject(null)} onSave={async (id, values) => { await updateProject(id, values); }} />
    </main>
  );
}
