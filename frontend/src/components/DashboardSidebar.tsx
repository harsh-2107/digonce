import { Building2, LogOut, MapPinned, Waves } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
const departmentNames = {
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
      <button className="nav-item active">
        <Building2 size={18} /> Overview
      </button>
      <button className="nav-item">
        <MapPinned size={18} /> Infrastructure map
      </button>
      <button className="nav-item">
        <Waves size={18} /> Planned works <span className="badge">3</span>
      </button>
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
