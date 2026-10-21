import { esquecerSondagem } from '../lib/sonda';

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

/** Opções aceitas por uma requisição (mesma forma repassada ao `fetch`). */
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

export function clearSession(): void {
  localStorage.removeItem('token');
  // A sondagem do primeiro uso vale para a conta que estava logada. Toda saída
  // de sessão passa por aqui (logout, exclusão da conta, 401), então a próxima
  // conta desta aba é sondada de novo (#273).
  esquecerSondagem();
}

/**
 * Limpa a sessão apenas se o token atual ainda for `token` (inclusive `null`).
 * Fecha a maior parte da janela em que outra aba troca a conta entre a resposta
 * e a limpeza — a checagem e o `removeItem` ficam no mesmo bloco síncrono
 * (review do PR #292). Devolve se limpou.
 */
export function clearSessionIfCurrent(token: string | null): boolean {
  if (getToken() !== token) return false;
  clearSession();
  return true;
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
        // nova. A limpeza reconfere o token imediatamente antes do `removeItem`
        // (review do PR #292).
        if (
          (tokenAgora === null || tokenAgora === token) &&
          clearSessionIfCurrent(tokenAgora)
        ) {
          window.dispatchEvent(new CustomEvent('noiteboa:session-change'));
          throw new Error('Sessão expirada. Faça login novamente.');
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
