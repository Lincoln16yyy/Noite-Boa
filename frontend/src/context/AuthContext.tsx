import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { api, clearSession, getToken } from '../api/client';
import type { LoginResult, RegisterResult, User } from '../api/types';

/** Valor do contexto de autenticação. */
export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /**
   * Token da sessão atual: muda no login/logout antes de o `/me` responder.
   * É a identidade usada para descartar estado da conta anterior (review do
   * PR #292).
   */
  sessao: string | null;
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
  // Token da sessão, reativo. O `getToken()` sozinho não avisa quando outra
  // parte troca a sessão; as rotas que dependem da conta (primeiro uso, por
  // exemplo) precisam de um valor que mude junto.
  const [sessao, setSessao] = useState<string | null>(getToken);
  // Evita setState após o desmonte (o /me pendente pode responder tarde e o
  // jsdom já ter sido desmontado nos testes — "window is not defined").
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const refreshUser = useCallback(async () => {
    // O /me vale para a sessão que o pediu. Se o token mudar até a resposta
    // (outra conta logou), o resultado é de uma sessão que já saiu e não pode
    // sobrescrever o usuário atual (review do PR #292).
    const tokenDaRequisicao = getToken();
    const mesmaSessao = () => montado.current && getToken() === tokenDaRequisicao;
    try {
      const me = await api.get<User>('/me');
      if (mesmaSessao()) setUser(me);
    } catch {
      if (mesmaSessao()) setUser(null);
    } finally {
      if (montado.current) {
        if (getToken() === tokenDaRequisicao) {
          setLoading(false);
        } else {
          // O token mudou durante o /me (outra aba trocou de conta, por
          // exemplo): esta janela não recebe o evento da outra, então refaz a
          // consulta para a sessão atual. Sem isso o `loading` ficaria true
          // para sempre e o app não sairia do esqueleto (review do PR #292).
          window.dispatchEvent(new CustomEvent('noiteboa:session-change'));
        }
      }
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Escuta eventos de mudança de sessão (login/logout/401)
  useEffect(() => {
    const handleSessionChange = () => {
      setSessao(getToken());
      void refreshUser();
    };
    window.addEventListener('noiteboa:session-change', handleSessionChange);
    return () => window.removeEventListener('noiteboa:session-change', handleSessionChange);
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<LoginResult>('/auth/login', { email, password });
    if (res?.accessToken) {
      localStorage.setItem('token', res.accessToken);
      setSessao(res.accessToken);
      window.dispatchEvent(new CustomEvent('noiteboa:session-change'));
      return res;
    }
    throw new Error('Login falhou');
  }, []);

  const register = useCallback(async (displayName: string, email: string, password: string) => {
    const res = await api.post<RegisterResult>('/auth/register', { displayName, email, password });
    return res;
  }, []);

  const logout = useCallback(() => {
    // `clearSession` também esquece a sonda do primeiro uso: a próxima conta
    // desta aba precisa ser sondada de novo (#273). O indicador do aparelho
    // (localStorage) continua.
    clearSession();
    setSessao(null);
    setUser(null);
    window.dispatchEvent(new CustomEvent('noiteboa:session-change'));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, sessao, login, register, logout, refreshUser }}>
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
