import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "./api";

export interface User {
  id: number;
  username: string;
  email?: string;
  role: "admin" | "employee";
  permissions?: string;
  maxSessions?: number;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ mustChangePassword: boolean }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("edu_token"));
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const u = await api.get<User>("/auth/me");
      setUserState(u);
    } catch {
      setUserState(null);
      setToken(null);
      localStorage.removeItem("edu_token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (username: string, password: string) => {
    const data = await api.post<{ token: string; user: User }>("/auth/login", { username, password });
    setToken(data.token);
    localStorage.setItem("edu_token", data.token);
    setUserState(data.user);
    return { mustChangePassword: data.user.mustChangePassword };
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    setUserState(null);
    setToken(null);
    localStorage.removeItem("edu_token");
  };

  const setUser = (u: User) => setUserState(u);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
