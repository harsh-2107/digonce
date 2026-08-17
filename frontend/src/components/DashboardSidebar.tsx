import { Building2, LogOut, MapPinned, Waves } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const departmentNames: Record<string, string> = {
  water: "Water Supply",
  sewage: "Sewage",
  drainage: "Drainage",
  "natural-gas": "Natural Gas",
  fibre: "Fibre Network",
  "super-admin": "All departments",
};

export function DashboardSidebar() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const isAdmin = user.department === "super-admin";
  return (
    <aside>
      <div className="brand">
        <div className="brand-mark">
          <MapPinned size={21} />
        </div>
        <span>
          dig<span>once</span>
        </span>
      </div>
      <p className="side-label">WORKSPACE</p>
      <NavLink to="/dashboard" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
        <Building2 size={18} /> Overview
      </NavLink>
      <NavLink to="/map" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
        <MapPinned size={18} /> Infrastructure map
      </NavLink>
      <NavLink to="/ongoing-projects" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
        <Waves size={18} /> Planned works
      </NavLink>
      <p className="side-label">ACCESS</p>
      <button className="nav-item department">
        <i>{isAdmin ? "★" : "●"}</i>
        {isAdmin ? "All departments" : departmentNames[user.department]}
      </button>
      <div className="account">
        <div className="avatar">{user.name.slice(0, 2)}</div>
        <div>
          <b>{user.name}</b>
          <small>{user.role}</small>
        </div>
        <button onClick={logout} title="Sign out">
          <LogOut size={17} />
        </button>
      </div>
    </aside>
  );
}
