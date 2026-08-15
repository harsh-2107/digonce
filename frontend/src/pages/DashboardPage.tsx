import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DashboardOverview } from "@/components/DashboardOverview";
import "@/App.css";
export function DashboardPage() {
  return (
    <div className="dashboard">
      <DashboardSidebar />
      <DashboardOverview />
    </div>
  );
}
