import { useState } from "react";
import type { FormEvent } from "react";
import { ChevronRight, Eye, EyeOff, MapPinned } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import "@/App.css";

const accounts = [
  ["Super Admin", "admin@digonce.gov.in", "admin123"],
  ["Water", "water@digonce.gov.in", "water123"],
  ["Sewage", "sewage@digonce.gov.in", "sewage123"],
  ["Drainage", "drainage@digonce.gov.in", "drainage123"],
  ["Natural Gas", "gas@digonce.gov.in", "gas123"],
  ["Fibre", "fibre@digonce.gov.in", "fibre123"],
];
export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  if (user) return <Navigate to="/map" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate("/map");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="login-page">
      <section className="brand-panel">
        <div className="brand">
          <div className="brand-mark">
            <MapPinned size={25} />
          </div>
          <span>
            dig<span>once</span>
          </span>
        </div>
        <div className="brand-copy">
          <p className="eyebrow">NAGPUR MUNICIPAL CORPORATION</p>
          <h1>
            One city.
            <br />
            <em>One coordinated plan.</em>
          </h1>
          <p>
            Coordinate underground infrastructure works before the road is
            opened.
          </p>
        </div>
        <div className="network-visual">
          <div className="road">NAGPUR ROAD CORRIDOR</div>
          <div className="line water" />
          <div className="line sewage" />
          <div className="line power" />
          <div className="line fibre" />
        </div>
        <p className="brand-footer">
          DIG ONCE NAGPUR · Infrastructure Coordination Platform
        </p>
      </section>
      <section className="login-panel">
        <div className="login-box">
          <div className="mobile-brand brand">
            <div className="brand-mark">
              <MapPinned size={21} />
            </div>
            <span>
              dig<span>once</span>
            </span>
          </div>
          <p className="eyebrow">SECURE ACCESS</p>
          <h2>Welcome back</h2>
          <p className="intro">
            Sign in to manage your department's infrastructure and planned
            works.
          </p>
          <form onSubmit={submit}>
            <label>
              Official email
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@digonce.gov.in"
                type="email"
                required
              />
            </label>
            <label>
              Password
              <div className="password-input">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  type={show ? "text" : "password"}
                  required
                />
                <button type="button" onClick={() => setShow(!show)}>
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="sign-in" disabled={loading}>
              {loading ? (
                "Signing in…"
              ) : (
                <>
                  Sign in securely <ChevronRight size={19} />
                </>
              )}
            </button>
          </form>
          <div className="demo">
            <span>Demo accounts</span>
            <div className="demo-grid">
              {accounts.map(([label, demoEmail, demoPassword]) => (
                <button
                  key={demoEmail}
                  type="button"
                  onClick={() => {
                    setEmail(demoEmail);
                    setPassword(demoPassword);
                    setError("");
                  }}
                >
                  <b>{label}</b>
                  <small>{demoEmail}</small>
                </button>
              ))}
            </div>
            <p>Click an account to fill in its hard-coded credentials.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
