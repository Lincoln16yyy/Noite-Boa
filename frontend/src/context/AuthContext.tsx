import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api, clearSession } from '../api/client';
import type { LoginResult, RegisterResult, User } from '../api/types';

/** Valor do contexto de autenticação. */
export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (displayName: string, email: string, password: string) => Promise<RegisterResult>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Provedor de estado de autenticação reativo.
 * Atualiza automaticamente no login, logout e 401.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.get<User>('/me');
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Escuta eventos de mudança de sessão (login/logout/401)
  useEffect(() => {
    const handleSessionChange = () => refreshUser();
    window.addEventListener('noiteboa:session-change', handleSessionChange);
    return () => window.removeEventListener('noiteboa:session-change', handleSessionChange);
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<LoginResult>('/auth/login', { email, password });
    if (res?.accessToken) {
      localStorage.setItem('token', res.accessToken);
      window.dispatchEvent(new CustomEvent('noiteboa:session-change'));
      return res;
    }
    throw new Error('Login falhou');
  }, []);

  const register = useCallback(async (displayName: string, email: string, password: string) => {
    const res = await api.post<RegisterResult>('/auth/register', { displayName, email, password });
    // NOTA (issue #188): `RegisterResponse` NÃO tem `accessToken` (só o /login
    // tem), então esta função sempre lança. É um bug conhecido (sem consumidor no
    // app), preservado de propósito (regra: migração não muda comportamento).
    // @ts-expect-error `RegisterResponse` não devolve accessToken (bug da #188)
    if (res?.accessToken) {
      window.dispatchEvent(new CustomEvent('noiteboa:session-change'));
      return res;
    }
    throw new Error('Cadastro falhou');
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    window.dispatchEvent(new CustomEvent('noiteboa:session-change'));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Hook para acessar o contexto de autenticação */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
