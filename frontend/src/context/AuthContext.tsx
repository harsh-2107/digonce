import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

export type Department =
  | "water"
  | "sewage"
  | "drainage"
  | "natural-gas"
  | "fibre"
  | "super-admin";
export type User = { name: string; department: Department; role: string };
type AuthContextValue = {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// API base URL - reads VITE_API_URL env var, falling back to relative /api in prod or localhost in dev
export const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "/api" : "http://localhost:8001");
export function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("dig-once-token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = sessionStorage.getItem("dig-once-user");
    const token = sessionStorage.getItem("dig-once-token");
    if (!saved || !token) {
      sessionStorage.removeItem("dig-once-user");
      sessionStorage.removeItem("dig-once-token");
      return null;
    }
    try {
      return JSON.parse(saved) as User;
    } catch {
      sessionStorage.removeItem("dig-once-user");
      sessionStorage.removeItem("dig-once-token");
      return null;
    }
  });

  async function login(email: string, password: string) {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Login failed");
      }

      const loginData = await response.json();
      if (!loginData.access_token || !loginData.user)
        throw new Error("Login response was incomplete.");
      const userData = loginData.user as User;
      sessionStorage.setItem("dig-once-user", JSON.stringify(userData));
      sessionStorage.setItem("dig-once-token", loginData.access_token);
      setUser(userData);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message || "Unable to sign in.");
      }
      throw new Error("Unable to sign in.");
    }
  }

  function logout() {
    sessionStorage.removeItem("dig-once-user");
    sessionStorage.removeItem("dig-once-token");
    setUser(null);
  }
  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
