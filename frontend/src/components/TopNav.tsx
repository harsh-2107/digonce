import { useEffect, useState } from "react";
import { Activity, Bell, FolderKanban, GitMerge, LogOut, MapPinned, Plus } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { API_BASE, authHeaders, useAuth } from "@/context/AuthContext";

export function TopNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    const fetchUnreadCount = () => {
      fetch(`${API_BASE}/notifications/unread-count`, { headers: authHeaders() })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (isMounted && data && typeof data.count === "number") {
            setUnreadCount(data.count);
          }
        })
        .catch(() => {});
    };

    fetchUnreadCount();

    const interval = setInterval(fetchUnreadCount, 10000);
    window.addEventListener("notificationsRead", fetchUnreadCount);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("notificationsRead", fetchUnreadCount);
    };
  }, [location.pathname, user]);

  return (
    <header className="top-nav">
      <NavLink to="/map" className="brand">
        <div className="brand-mark">
          <MapPinned size={21} />
        </div>
        <span>
          dig<span>once</span>
        </span>
      </NavLink>
      <nav>
        <NavLink to="/notifications">
          <Bell size={16} /> Notifications
          {unreadCount > 0 && (
            <span className="nav-badge" title={`${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`}>
              {unreadCount}
            </span>
          )}
        </NavLink>
        <NavLink to="/projects">
          <FolderKanban size={16} /> Projects
        </NavLink>
        <NavLink to="/ongoing-projects">
          <Activity size={16} /> Ongoing Projects
        </NavLink>
        <NavLink to="/coordination">
          <GitMerge size={16} /> Coordinate
        </NavLink>
        <NavLink to="/projects/new" className="create-tab">
          <Plus size={17} /> Create project
        </NavLink>
      </nav>
      <div className="nav-user">
        <div>
          <b>{user?.name}</b>
          <small>{user?.role}</small>
        </div>
        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          title="Sign out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
