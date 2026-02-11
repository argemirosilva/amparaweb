import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Usuario {
  id: string;
  email: string;
  nome_completo: string;
}

interface AuthContextType {
  usuario: Usuario | null;
  sessionToken: string | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<{ success: boolean; error?: string; redirect?: string; email?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string; email?: string }>;
  verifyEmail: (email: string, codigo: string) => Promise<{ success: boolean; error?: string }>;
  resendCode: (email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

interface RegisterData {
  nome_completo: string;
  telefone: string;
  email: string;
  senha: string;
  termos_aceitos: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

async function callFunction(name: string, body: Record<string, any>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(() => 
    localStorage.getItem("ampara_session_token")
  );
  const [loading, setLoading] = useState(true);

  const checkSession = useCallback(async () => {
    const token = localStorage.getItem("ampara_session_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { ok, data } = await callFunction("auth-session", { session_token: token });
      if (ok && data.valid) {
        setUsuario(data.usuario);
        setSessionToken(token);
      } else {
        localStorage.removeItem("ampara_session_token");
        setSessionToken(null);
        setUsuario(null);
      }
    } catch {
      localStorage.removeItem("ampara_session_token");
      setSessionToken(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = async (email: string, senha: string) => {
    const { ok, data } = await callFunction("auth-login", { email, senha });
    if (ok && data.success) {
      localStorage.setItem("ampara_session_token", data.session.token);
      setSessionToken(data.session.token);
      setUsuario(data.usuario);
      return { success: true };
    }
    if (data.redirect === "verify") {
      return { success: false, error: data.error, redirect: "verify", email: data.email };
    }
    return { success: false, error: data.error || "Erro ao fazer login" };
  };

  const register = async (regData: RegisterData) => {
    const { ok, data } = await callFunction("auth-register", regData);
    if (ok && data.success) {
      return { success: true, email: data.email };
    }
    return { success: false, error: data.error || "Erro ao cadastrar" };
  };

  const verifyEmail = async (email: string, codigo: string) => {
    const { ok, data } = await callFunction("auth-verify-email", { email, codigo });
    if (ok && data.success && data.verified) {
      return { success: true };
    }
    if (data.already_verified) {
      return { success: true };
    }
    return { success: false, error: data.error || "Erro ao verificar" };
  };

  const resendCode = async (email: string) => {
    const { ok, data } = await callFunction("auth-verify-email", { email, resend: true });
    if (ok && data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || "Erro ao reenviar código" };
  };

  const logout = async () => {
    if (sessionToken) {
      await callFunction("auth-logout", { session_token: sessionToken });
    }
    localStorage.removeItem("ampara_session_token");
    setSessionToken(null);
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, sessionToken, loading, login, register, verifyEmail, resendCode, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
