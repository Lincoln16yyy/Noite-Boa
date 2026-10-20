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
}

/**
 * Opções que os wrappers (`api.get`/`post`/`put`/`delete`) aceitam. O verbo e o
 * corpo são decididos por cada método — deixar o chamador informá-los permitiria
 * um `DELETE` disfarçado de `GET` (#266).
 */
export type MetodoOptions = Omit<RequestOptions, 'method' | 'body'>;

function getToken(): string | null {
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
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
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
      ...options,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      const message = await readProblemMessage(response);

      // 401 com a mesma sessão que fez a requisição = token expirado/inválido:
      // limpa e avisa o contexto. Se o token já mudou (outra conta logou
      // enquanto esta requisição estava em voo), o 401 é da sessão antiga e não
      // pode derrubar a nova (review do PR #292). Sem token no envio = falha de
      // autenticação (ex.: senha errada): só mostra o erro.
      if (response.status === 401 && token && getToken() === token) {
        clearSession();
        window.dispatchEvent(new CustomEvent('noiteboa:session-change'));
        throw new Error('Sessão expirada. Faça login novamente.');
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
