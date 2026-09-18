import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "./api";
import type { PublicUser } from "./types";

interface AuthState {
  user: PublicUser | null;
  loading: boolean;
  needsSetup: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const me = await api.get<PublicUser>("/auth/me");
      setUser(me);
      setNeedsSetup(false);
    } catch (err) {
      setUser(null);
      if (err instanceof ApiError && err.status === 401) {
        try {
          const status = await api.get<{ needsSetup: boolean }>("/auth/status");
          setNeedsSetup(status.needsSetup);
        } catch {
          setNeedsSetup(false);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await api.post("/auth/logout");
    setUser(null);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, needsSetup, refresh, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
