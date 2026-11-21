"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  clearToken,
  getToken,
  setToken,
} from "@/lib/api";
import type { User } from "@/lib/types";

interface RegisterInput {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  oauthLogin: (code: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api<User>("/api/auth/me");
      setUser(me);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    function handleUnauthorized() {
      setUser(null);
    }
    window.addEventListener("philippines-cities:unauthorized", handleUnauthorized);
    return () =>
      window.removeEventListener("philippines-cities:unauthorized", handleUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const token = await api<{ access_token: string }>("/api/auth/login", {
      method: "POST",
      form: { username: email, password },
      auth: false,
    });
    setToken(token.access_token);
    const me = await api<User>("/api/auth/me");
    setUser(me);
    setLoading(false);
  }, []);

  const oauthLogin = useCallback(async (code: string) => {
    const token = await api<{ access_token: string }>("/api/auth/oauth/exchange", {
      method: "POST",
      body: { code },
      auth: false,
    });
    setToken(token.access_token);
    const me = await api<User>("/api/auth/me");
    setUser(me);
    setLoading(false);
  }, []);

  const register = useCallback(
    async (input: RegisterInput) => {
      await api("/api/auth/register", {
        method: "POST",
        body: input,
        auth: false,
      });
      await login(input.email, input.password);
    },
    [login],
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const updateUser = useCallback((nextUser: User) => {
    setUser(nextUser);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      oauthLogin,
      register,
      logout,
      refreshUser,
      updateUser,
    }),
    [user, loading, login, oauthLogin, register, logout, refreshUser, updateUser],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
