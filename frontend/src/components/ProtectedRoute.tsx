import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ProjectsProvider } from "@/context/ProjectsContext";
export function ProtectedRoute() {
  return useAuth().user ? (
    <ProjectsProvider>
      <Outlet />
    </ProjectsProvider>
  ) : (
    <Navigate to="/login" replace />
  );
}
