import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import { MapPage } from "@/pages/MapPage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { CreateProjectPage } from "@/pages/CreateProjectPage";
import { ProjectDetailsPage } from "@/pages/ProjectDetailsPage";
import { CoordinationPage } from "@/pages/CoordinationPage";
import { CoordinationProposalPage } from "@/pages/CoordinationProposalPage";
import { ProjectGroupPage } from "@/pages/ProjectGroupPage";
import { GisProvider } from "@/context/GisContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/map" element={<GisProvider><MapPage /></GisProvider>} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/new" element={<GisProvider><CreateProjectPage /></GisProvider>} />
        <Route path="/projects/:projectId" element={<ProjectDetailsPage />} />
        <Route path="/projects/:projectId/analysis" element={<ProjectDetailsPage />} />
        <Route path="/coordination" element={<CoordinationPage />} />
        <Route path="/coordination/proposals/:proposalId" element={<CoordinationProposalPage />} />
        <Route path="/coordination/incoming/:proposalId" element={<CoordinationProposalPage />} />
        <Route path="/project-groups/:groupId" element={<ProjectGroupPage />} />
        <Route path="/project-groups/:groupId/edit" element={<ProjectGroupPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/map" replace />} />
    </Routes>
  );
}
