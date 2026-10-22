import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { api, clearSessionIfCurrent, getSessionGeneration, getToken, saveSession } from '../api/client';
import type { LoginResult, RegisterResult, User } from '../api/types';

/** Como um logout terminou: saiu, a sessão já era outra, ou falhou. */
export type ResultadoLogout = 'saiu' | 'sessao-mudou' | 'falhou';

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
  /**
   * Mensagem quando o `/me` falhou com o token ainda presente — qualquer
   * falha que não seja sessão encerrada (rede, 5xx, resposta inválida). O
   * `Layout` mostra um aviso com "Tentar de novo" (#294).
   */
  erroSessao: string | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (displayName: string, email: string, password: string) => Promise<RegisterResult>;
  logout: () => Promise<ResultadoLogout>;
  refreshUser: () => Promise<boolean>;
  /** Reconsulta o `/me` depois de uma falha de sessão, com o `loading` ligado. */
  tentarNovamente: () => Promise<boolean>;
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
  const [erroSessao, setErroSessao] = useState<string | null>(null);
  // Evita setState após o desmonte (o /me pendente pode responder tarde e o
  // jsdom já ter sido desmontado nos testes — "window is not defined").
  const montado = useRef(true);
  // Geração das consultas ao /me. Respostas de gerações antigas não escrevem
  // no estado: duas consultas podem se sobrepor (uma do evento, outra da
  // troca de token) e a mais lenta não pode sobrescrever a mais nova.
  const geracao = useRef(0);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const refreshUser = useCallback(async (): Promise<boolean> => {
    // O /me vale para a sessão que o pediu. Se o token mudar até a resposta
    // (outra conta logou), o resultado é de uma sessão que já saiu e não pode
    // sobrescrever o usuário atual. Mesmo com o token igual, só a consulta mais
    // recente pode escrever no estado (review do PR #292).
    const minhaGeracao = ++geracao.current;
    const geracaoDaConsulta = getSessionGeneration();
    const tokenDaRequisicao = getToken();
    // Nova tentativa: some com o aviso anterior; se falhar de novo, ele volta.
    if (tokenDaRequisicao !== null) setErroSessao(null);
    // Token E geração: uma sessão reaberta com o mesmo token é outra sessão, e
    // a resposta antiga não pode mexer nela (review do #310).
    const atual = () =>
      montado.current &&
      geracao.current === minhaGeracao &&
      getToken() === tokenDaRequisicao &&
      getSessionGeneration() === geracaoDaConsulta;
    try {
      const me = await api.get<User>('/me');
      // 204/JSON `null` não é usuário: sem esta checagem o `Layout` trataria
      // como deslogado e mandaria para /login com o token ainda presente (#294).
      if (!me || typeof me !== 'object' || typeof me.id !== 'string') {
        throw new Error('Resposta inválida do /me');
      }
      if (atual()) {
        setUser(me);
        setErroSessao(null);
        // A resposta é da sessão `tokenDaRequisicao`: se outra aba trocou o
        // token e esta ainda não processou o `storage`, o retry carrega a
        // conta nova — a identidade da tela precisa acompanhar (#294).
        setSessao(tokenDaRequisicao);
        return true;
      }
      return false;
    } catch (erro) {
      if (atual()) {
        setUser(null);
        // A consulta foi feita com `tokenDaRequisicao`: se outra aba trocou o
        // token e esta tela ainda não processou o `storage`, a identidade
        // precisa acompanhar para o primeiro Sair derrubar o token certo (#294).
        setSessao(tokenDaRequisicao);
        // Token ainda presente: a sessão não acabou, o `/me` é que não veio.
        // Não pode virar logout (#294). A mensagem é neutra de propósito: o
        // mesmo caminho cobre rede, 5xx e resposta inválida — prometer "é a
        // conexão" mentiria nos outros casos.
        if (getToken() !== null) {
          // Operadores precisam distinguir 5xx persistente de rede nos
          // relatos; o usuário continua vendo só a mensagem genérica.
          console.error('[auth] falha ao carregar /me', erro);
          // Sessão expirada cuja limpeza não pôde ser feita (lock fora do ar):
          // a mensagem genérica esconderia que é preciso entrar de novo.
          setErroSessao(
            erro instanceof Error && erro.message.includes('Sessão expirada')
              ? 'Sua sessão expirou e não foi possível encerrá-la neste navegador. Recarregue a página e entre de novo.'
              : 'Não foi possível carregar sua sessão. Tente de novo.',
          );
        }
      }
      return false;
    } finally {
      if (montado.current && geracao.current === minhaGeracao) {
        if (
          getToken() === tokenDaRequisicao &&
          getSessionGeneration() !== geracaoDaConsulta
        ) {
          // Mesmo token, geração nova: a sessão foi reaberta durante o /me.
          // O resultado descartado não pode deixar a tela em "carregando":
          // refaz a consulta para a sessão atual (review do #310).
          window.dispatchEvent(new CustomEvent('noiteboa:session-change'));
        } else if (getToken() === tokenDaRequisicao) {
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
      const token = getToken();
      setSessao(token);
      // Esconde a conta anterior e segura a guarda em "carregando" até o /me
      // da sessão nova chegar; sem isso, o `Layout` vê `user` nulo e pisca o
      // login antes de voltar (#297).
      setUser(null);
      if (!token) {
        // Sessão encerrada (logout/401): não há o que consultar sem token.
        setErroSessao(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      void refreshUser();
    };
    window.addEventListener('noiteboa:session-change', handleSessionChange);
    return () => window.removeEventListener('noiteboa:session-change', handleSessionChange);
  }, [refreshUser]);

  // Outra aba pode trocar ou remover o token (localStorage é compartilhado).
  // O evento `storage` só chega nas OUTRAS abas — sem ele, esta ficaria com o
  // usuário antigo enquanto a sonda e as requisições já usam a conta nova
  // (review do PR #292).
  useEffect(() => {
    const handleStorage = (evento: StorageEvent) => {
      // `localStorage.clear()` chega com `key` nulo (qualquer chave mudou).
      if (evento.key !== null && evento.key !== 'token') return;
      const token = getToken();
      setSessao(token);
      // Esconde a conta anterior enquanto o /me da nova não chega: as páginas
      // não podem continuar mostrando (nem salvar) dados da sessão que saiu.
      setUser(null);
      if (!token) {
        setErroSessao(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      void refreshUser();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    // Geração antes do pedido: se outra aba sair enquanto o login está em voo,
    // a resposta não pode gravar o token e ressuscitar a sessão que saiu
    // (review do #310).
    const geracaoDoPedido = getSessionGeneration();
    const res = await api.post<LoginResult>('/auth/login', { email, password });
    if (res?.accessToken) {
      const gravou = await saveSession(res.accessToken, geracaoDoPedido);
      if (!gravou) throw new Error('A sessão mudou durante o login. Tente de novo.');
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

  const logout = useCallback(async (): Promise<ResultadoLogout> => {
    // Storage bloqueado já na leitura: sem isto o clique rejeitaria a promessa
    // e a tela ficaria sem a mensagem de falha (review do #310).
    let geracaoDaSessao: string | null;
    let token: string | null;
    try {
      geracaoDaSessao = getSessionGeneration();
      token = getToken();
    } catch (erro) {
      console.error('[auth] storage indisponível ao ler a sessão', erro);
      return 'falhou';
    }
    // Esta tela representa a sessão `sessao`. Se outra aba já trocou o token e
    // o evento `storage` ainda não chegou aqui, o clique de sair é da sessão
    // ANTIGA: derrubar o token levaria a conta nova junto (review do PR #292).
    if (token !== null && token !== sessao) {
      setSessao(token);
      setUser(null);
      window.dispatchEvent(new CustomEvent('noiteboa:session-change'));
      return 'sessao-mudou';
    }
    // Mesmo depois dessa guarda, outra aba pode gravar um token novo antes da
    // remoção. `clearSessionIfCurrent` reconfere dentro do lock e, se a conta
    // mudou, não derruba a nova (#293).
    let limpou = false;
    try {
      limpou = await clearSessionIfCurrent(token, undefined, geracaoDaSessao);
    } catch (erro) {
      // A sessão pode ter mudado enquanto o lock falhava: aí o clique era da
      // sessão antiga e a tela nova não pode receber o erro de logout dela
      // (review do #310).
      let tokenAgora: string | null;
      try {
        tokenAgora = getToken();
      } catch {
        tokenAgora = token;
      }
      // Se o lock nem chegou a rodar, a geração não mudou por esta tentativa:
      // compará-la distingue "a sessão foi reaberta" de "a saída falhou". Se a
      // remoção rodou e falhou, a geração pode ter avançado sem troca de token
      // (rollback impossível), então aí vale só o token.
      const falhaDeLock =
        erro instanceof Error && erro.message.includes('operação de sessão');
      if (
        tokenAgora !== token ||
        (falhaDeLock && getSessionGeneration() !== geracaoDaSessao)
      ) {
        setSessao(tokenAgora);
        setUser(null);
        setErroSessao(null);
        window.dispatchEvent(new CustomEvent('noiteboa:session-change'));
        return tokenAgora === null ? 'saiu' : 'sessao-mudou';
      }
      // Storage bloqueado ou lock indisponível: o token não saiu. Sair do
      // estado local deixaria a pessoa "deslogada" até recarregar e voltar
      // para a conta — pior que não sair. A tela que chamou mostra o erro.
      console.error('[auth] não foi possível limpar a sessão', erro);
      return 'falhou';
    }
    if (!limpou) {
      setSessao(getToken());
      setUser(null);
      window.dispatchEvent(new CustomEvent('noiteboa:session-change'));
      return 'sessao-mudou';
    }
    // `clearSessionIfCurrent` também esquece a sonda do primeiro uso: a próxima
    // conta desta aba precisa ser sondada de novo (#273). O indicador do
    // aparelho (localStorage) continua.
    setErroSessao(null);
    setSessao(null);
    setUser(null);
    window.dispatchEvent(new CustomEvent('noiteboa:session-change'));
    return 'saiu';
  }, [sessao]);

  const tentarNovamente = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    return refreshUser();
  }, [refreshUser]);

  return (
    <AuthContext.Provider value={{ user, loading, sessao, erroSessao, login, register, logout, refreshUser, tentarNovamente }}>
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
