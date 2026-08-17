import { Link } from "react-router-dom";
import type { Project } from "@/context/ProjectsContext";

export function ProjectCardActions({ project, onViewDetails: _onViewDetails, canCoordinate = false }: { project: Project; onViewDetails?: () => void; canCoordinate?: boolean }) {
  return <div className="project-actions">
    <Link className="secondary-button" to={`/projects/${project.project_id}`}>View details</Link>
    {project.status !== "DISCARDED" && canCoordinate && <Link className="secondary-button" to={`/projects/${project.project_id}/analysis`}>Coordinate</Link>}
  </div>;
}
