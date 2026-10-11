import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, clearSession } from '../api/client';

const AuthContext = createContext(null);

/**
 * Provedor de estado de autenticação reativo.
 * Atualiza automaticamente no login, logout e 401.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.get('/me');
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

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res?.accessToken) {
      // api.client já guarda o token no localStorage
      window.dispatchEvent(new CustomEvent('noiteboa:session-change'));
      return res;
    }
    throw new Error('Login falhou');
  }, []);

  const register = useCallback(async (displayName, email, password) => {
    const res = await api.post('/auth/register', { displayName, email, password });
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
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}