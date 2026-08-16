import { Link } from "react-router-dom";
import type { Project } from "@/context/ProjectsContext";

export function ProjectCardActions({ project, onViewDetails }: { project: Project; onViewDetails: () => void }) {
  return <div className="project-actions">
    <button className="secondary-button" onClick={onViewDetails}>View details</button>
    <Link className="secondary-button" to={`/projects/${project.project_id}/analysis`}>Coordinate</Link>
  </div>;
}
