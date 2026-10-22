import { esquecerSondagem } from '../lib/sonda';
import { comLockDeSessao } from '../lib/lock-sessao';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

/** Tempo padrão de timeout (ms) — pode ser alterado via `api.setTimeout(ms)` */
let requestTimeout = 30000;

/** Erro no formato ProblemDetail (RFC 7807) que o back-end devolve. */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
}

/**
 * Opções de uma requisição. O cliente as consome e transforma: `headers` é
 * mesclado com os padrões, `signal` é combinado com o timeout interno e
 * `token` vira o `Authorization` (não vai para o `fetch`) (#298).
 */
export interface RequestOptions {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /**
   * Token explícito da requisição. Sem ele, usa o token atual do `localStorage`.
   * Permite que uma tela carregada pela conta A escreva com o token de A mesmo
   * que outra aba já tenha trocado para B (#298).
   */
  token?: string;
}

/**
 * Opções que os wrappers (`api.get`/`post`/`put`/`delete`) aceitam. O verbo e o
 * corpo são decididos por cada método — deixar o chamador informá-los permitiria
 * um `DELETE` disfarçado de `GET` (#266).
 */
export type MetodoOptions = Omit<RequestOptions, 'method' | 'body'>;

/**
 * Token da sessão atual. Exportado para quem precisa saber se a sessão que
 * iniciou uma requisição ainda é a mesma quando a resposta chega (review do
 * PR #292).
 */
export function getToken(): string | null {
  return localStorage.getItem('token');
}

/**
 * Marca de geração da sessão: muda a cada gravação ou remoção do token. Serve
 * para saber se uma escrita ficou obsoleta enquanto a requisição estava em voo
 * (um login cuja resposta chega depois de outra aba sair, review do #310).
 */
export const CHAVE_GERACAO = 'noiteboa-sessao-geracao';

export function getSessionGeneration(): string | null {
  try {
    return localStorage.getItem(CHAVE_GERACAO);
  } catch {
    // Storage bloqueado: quem chamar vai falhar na escrita de qualquer forma.
    return null;
  }
}

function avancarGeracao(): void {
  const nova =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  localStorage.setItem(CHAVE_GERACAO, nova);
}

/** Volta a geração ao valor anterior; o erro original é o que importa. */
function restaurarGeracao(anterior: string | null): void {
  try {
    if (anterior === null) localStorage.removeItem(CHAVE_GERACAO);
    else localStorage.setItem(CHAVE_GERACAO, anterior);
  } catch {
    // Best-effort: se nem o rollback couber no storage, a falha já vai subir.
  }
}

/** Remove o token e esquece a sonda. Só usar já dentro do lock de sessão. */
function limparSessaoSemLock(): void {
  // Sem token não há troca de sessão: não avance a geração, senão um 401
  // atrasado descartaria o login que está em voo nesta aba (review do #310).
  const tinhaToken = getToken() !== null;
  const geracaoAnterior = tinhaToken ? getSessionGeneration() : null;
  // A geração vem antes da remoção: se ela não puder ser gravada, nada mudou.
  if (tinhaToken) avancarGeracao();
  try {
    localStorage.removeItem('token');
  } catch (erro) {
    // A remoção falhou e o token continua: a geração também tem de continuar,
    // senão pedidos antigos seriam tratados como de outra sessão (review do #310).
    if (tinhaToken) restaurarGeracao(geracaoAnterior);
    throw erro;
  }
  // A sondagem do primeiro uso vale para a conta que estava logada. Toda saída
  // de sessão passa por aqui (logout, exclusão da conta, 401), então a próxima
  // conta desta aba é sondada de novo (#273).
  esquecerSondagem();
}

/**
 * Grava o token da sessão que acabou de entrar, serializado com as limpezas
 * das outras abas — senão um 401 atrasado poderia apagar o token novo (#293).
 *
 * `geracaoEsperada` é a geração lida antes do pedido de login. Se outra aba
 * gravou ou removeu a sessão nesse meio-tempo, a resposta velha não pode
 * ressuscitar a sessão que saiu: devolve `false` sem escrever (#310).
 */
export async function saveSession(
  token: string,
  geracaoEsperada?: string | null,
): Promise<boolean> {
  return comLockDeSessao(() => {
    if (geracaoEsperada !== undefined && getSessionGeneration() !== geracaoEsperada) {
      return false;
    }
    const tokenAnterior = getToken();
    // Token antes da geração: uma requisição que comece entre as duas escritas
    // (fora do lock) vê geração velha + token novo — combinação que nunca
    // confere no 401 e por isso não apaga a sessão (review do #310).
    localStorage.setItem('token', token);
    try {
      avancarGeracao();
    } catch (erro) {
      // Sem a geração, a sessão não pode ficar trocada pela metade: volta o
      // token anterior e falha (review do #310).
      try {
        if (tokenAnterior === null) localStorage.removeItem('token');
        else localStorage.setItem('token', tokenAnterior);
      } catch {
        // Best-effort: o storage já recusou a escrita; o erro original sobe.
      }
      throw erro;
    }
    return true;
  });
}

/**
 * Limpa a sessão apenas se o token atual ainda for `token` (inclusive `null`).
 * A conferência, o `removeItem` e o `aoLimpar` rodam dentro do mesmo lock; como
 * as escritas de token das outras abas também passam por ele, não sobra janela
 * entre ler, remover e concluir a saída (review do PR #292, #293, #310).
 * Devolve se limpou.
 *
 * `aoLimpar` existe para quem precisa anunciar a saída sem que outra conta
 * entre no meio (a exclusão da conta não pode mostrar o aviso de exclusão para
 * uma sessão nova).
 */
export async function clearSessionIfCurrent(
  token: string | null,
  aoLimpar?: () => void,
  geracaoEsperada?: string | null,
): Promise<boolean> {
  // Lida antes de entrar na fila: se a sessão for reaberta com o MESMO token
  // enquanto este pedido espera, a geração muda e o pedido antigo não apaga a
  // sessão nova (review do #310). Quem fez a requisição pode passar a geração
  // que valia no INÍCIO dela, para um 401 atrasado não derrubar a sessão nova.
  const geracaoDoPedido =
    geracaoEsperada === undefined ? getSessionGeneration() : geracaoEsperada;
  return comLockDeSessao(() => {
    if (getToken() !== token || getSessionGeneration() !== geracaoDoPedido) {
      return false;
    }
    limparSessaoSemLock();
    aoLimpar?.();
    return true;
  });
}

/**
 * Configura o timeout global (ms) — usado em testes para simular timeout rápido.
 *
 * Renomeado de `setTimeout` para evitar sombreamento do `window.setTimeout`
 * global (issue #186, #204).
 */
export function setRequestTimeout(ms: number): void {
  requestTimeout = ms;
}

async function readProblemMessage(response: Response): Promise<string> {
  try {
    const problem = (await response.json()) as ProblemDetail;
    if (problem.detail) return problem.detail;
    if (problem.title) return problem.title;
  } catch {
    // corpo não é ProblemDetail: mantém mensagem genérica
  }
  return '';
}

function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError && error.message === 'Failed to fetch';
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  // Token explícito (tela carregada por outra conta) ou o da sessão atual.
  // O campo não pode ir para o `fetch`: ele não conhece `token` (#298).
  const { token: tokenExplicito, ...opcoesFetch } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...options.headers };
  // Geração lida ANTES do token: se a sessão for reaberta com o mesmo token
  // entre as duas leituras, ficamos com uma geração velha (que não confere) em
  // vez de um par token velho + geração nova, que apagaria a sessão nova
  // (review do #310).
  const geracaoDoPedido = getSessionGeneration();
  const token = tokenExplicito !== undefined ? tokenExplicito : getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Permite passar signal externo para cancelamento (ex.: AbortController do efeito React)
  const externalSignal = options.signal;
  const controller = new AbortController();
  // Usa window.setTimeout explicitamente para evitar sombreamento do
  // setTimeout do módulo (issue #186).
  const timeoutId = window.setTimeout(() => controller.abort(), requestTimeout);
  const abortarInterno = () => controller.abort();

  // Se houver signal externo, aborta o controller interno quando ele disparar.
  // O listener sai no `finally` para não acumular quando o chamador reutiliza
  // o mesmo signal em várias requisições (#266).
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', abortarInterno);
    }
  }

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...opcoesFetch,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      const message = await readProblemMessage(response);

      // 401 com a mesma sessão que fez a requisição = token expirado/inválido:
      // limpa e avisa o contexto. Também vale quando não há mais token algum
      // (outra aba deslogou durante a requisição): a sessão desta janela
      // acabou e ela não recebeu o evento da outra (review do PR #292). Se
      // outra conta logou (token diferente, não nulo), o 401 é da sessão
      // antiga e não pode derrubar a nova. Sem token no envio = falha de
      // autenticação (ex.: senha errada): só mostra o erro.
      if (response.status === 401 && token) {
        const tokenAgora = getToken();
        // `null` = outra aba deslogou durante a requisição (a sessão desta
        // janela acabou); igual = token expirou. Diferente e não nulo = outra
        // conta assumiu, e o 401 é da sessão antiga, que não pode derrubar a
        // nova. A limpeza reconfere o token dentro do lock (#293), então uma
        // troca de conta entre a resposta e o `removeItem` não é derrubada.
        if (tokenAgora === null || tokenAgora === token) {
          let limpou = false;
          try {
            limpou = await clearSessionIfCurrent(
              tokenAgora,
              undefined,
              tokenAgora === null ? undefined : geracaoDoPedido,
            );
          } catch (erroLimpeza) {
            // Outra aba pode ter trocado a conta enquanto este pedido esperava
            // o lock: nesse caso o 401 é da sessão antiga e não pode acusar a
            // nova de expirada (review do #310).
            if (
              getToken() !== token ||
              getSessionGeneration() !== geracaoDoPedido
            ) {
              throw new Error(message || `Erro ${response.status}`, { cause: erroLimpeza });
            }
            // O 401 já provou que ESTA sessão não vale. Se o lock falhou, a
            // limpeza fica para a próxima operação: devolver o erro do lock
            // esconderia a sessão expirada e o contexto mostraria uma falha
            // genérica, sem o caminho de entrar de novo (review do #310).
            throw new Error('Sessão expirada. Faça login novamente.', {
              cause: erroLimpeza,
            });
          }
          if (limpou) {
            window.dispatchEvent(new CustomEvent('noiteboa:session-change'));
            throw new Error('Sessão expirada. Faça login novamente.');
          }
        }
      }

      throw new Error(message || `Erro ${response.status}`);
    }

    if (response.status === 204) return null as T; // 204 = sem corpo; quem chama tipa como void
    return (await response.json()) as T; // corpo JSON do recurso (tipo informado por quem chama)
  } catch (err) {
    if (err instanceof Error && (err.name === 'AbortError' || isNetworkError(err))) {
      throw new Error(
        'Não foi possível conectar ao servidor. Verifique sua conexão ou tente novamente mais tarde.',
        { cause: err },
      );
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', abortarInterno);
  }
}

export const api = {
  get: <T>(path: string, options?: MetodoOptions): Promise<T> => request<T>(path, options),
  post: <T>(path: string, body?: unknown, options?: MetodoOptions): Promise<T> =>
    request<T>(path, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown, options?: MetodoOptions): Promise<T> =>
    request<T>(path, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  delete: <T = void>(path: string, options?: MetodoOptions): Promise<T> =>
    request<T>(path, { ...options, method: 'DELETE' }),
  setRequestTimeout,
};
