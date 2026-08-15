import { ChevronRight, MapPinned, ShieldCheck, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
export function DashboardOverview() {
  const { user } = useAuth();
  if (!user) return null;
  const isAdmin = user.department === "super-admin";
  return (
    <main className="dashboard-main">
      <header>
        <div>
          <p className="eyebrow">
            {isAdmin
              ? "CITY-WIDE OVERVIEW"
              : `${user.department.replace("-", " ").toUpperCase()} DEPARTMENT`}
          </p>
          <h1>Good morning, {user.name.split(" ")[0]}.</h1>
        </div>
        <button className="new-work">
          <span>+</span> Add planned work
        </button>
      </header>
      <section className="status-strip">
        <Status
          type="blue"
          icon={<MapPinned size={18} />}
          text={`${isAdmin ? "5" : "1"} active network layer${isAdmin ? "s" : ""}`}
          sub="Infrastructure data updated today"
        />
        <Status
          type="amber"
          icon={<Zap size={18} />}
          text={`${isAdmin ? "7" : "2"} coordination opportunities`}
          sub="Require review this week"
        />
        <Status
          type="green"
          icon={<ShieldCheck size={18} />}
          text="₹18.6L potential savings"
          sub="Across compatible planned works"
        />
      </section>
      <div className="content-grid">
        <section className="map-card">
          <div className="card-head">
            <div>
              <h3>Infrastructure & planned works</h3>
              <p>
                {isAdmin
                  ? "All department layers visible"
                  : "Your department network layer"}
              </p>
            </div>
            <button>
              View full map <ChevronRight size={16} />
            </button>
          </div>
          <div className="map-placeholder">
            <div className="map-grid" />
            <div className="map-road r1" />
            <div className="map-road r2" />
            <div className="map-road r3" />
            <div className="map-node n1" />
            <div className="map-node n2" />
            <div className="map-node n3" />
            <div className="map-tag">
              Ward 32
              <br />
              <b>2 overlapping works</b>
            </div>
          </div>
        </section>
        <section className="alerts-card">
          <div className="card-head">
            <div>
              <h3>Coordination alerts</h3>
              <p>Potential overlaps detected</p>
            </div>
            <button>See all</button>
          </div>
          <Alert
            urgent
            title="Central Avenue · Ward 32"
            text="Water and Fibre works overlap by 8 days."
          />
          <Alert
            title="Hingna Road · Ward 18"
            text="Drainage work is planned in the same corridor."
          />
          <Alert
            title="Manish Nagar · Ward 41"
            text="Sewage and gas works were successfully coordinated."
          />
        </section>
      </div>
    </main>
  );
}
function Status({
  type,
  icon,
  text,
  sub,
}: {
  type: string;
  icon: ReactNode;
  text: string;
  sub: string;
}) {
  return (
    <div>
      <span className={`status-icon ${type}`}>{icon}</span>
      <p>
        <b>{text}</b>
        <small>{sub}</small>
      </p>
    </div>
  );
}
function Alert({
  urgent,
  title,
  text,
}: {
  urgent?: boolean;
  title: string;
  text: string;
}) {
  return (
    <div className={`alert ${urgent ? "urgent" : ""}`}>
      <span>{urgent ? "!" : "✓"}</span>
      <div>
        <b>{title}</b>
        <p>{text}</p>
        <a>
          {urgent ? "Review coordination" : "View project"}{" "}
          <ChevronRight size={14} />
        </a>
      </div>
    </div>
  );
}
