const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

/** Tempo padrão de timeout (ms) — pode ser alterado via `api.setRequestTimeout(ms)` */
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

function getToken(): string | null {
  return localStorage.getItem('token');
}

export function clearSession(): void {
  localStorage.removeItem('token');
}

/**
 * Configura o timeout global (ms) — usado em testes para simular timeout rápido.
 *
 * Renomeado de `setTimeout` para evitar sombreamento do `window.setTimeout`
 * global (issue #204, bug da #186).
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
  // setTimeout do módulo (issue #186, #204).
  const timeoutId = window.setTimeout(() => controller.abort(), requestTimeout);

  // Se houver signal externo, aborta o controller interno quando ele disparar
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', () => controller.abort());
    }
  }

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    window.clearTimeout(timeoutId);

    if (!response.ok) {
      const message = await readProblemMessage(response);

      // 401 com sessão ativa = token expirado/inválido: limpa e avisa o contexto.
      // 401 sem sessão = falha de autenticação (ex.: senha errada): só mostra o erro.
      const hadSession = Boolean(getToken());
      if (response.status === 401 && hadSession) {
        clearSession();
        window.dispatchEvent(new CustomEvent('noiteboa:session-change'));
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      throw new Error(message || `Erro ${response.status}`);
    }

    if (response.status === 204) return null as T; // 204 = sem corpo; quem chama tipa como void
    return (await response.json()) as T; // corpo JSON do recurso (tipo informado por quem chama)
  } catch (err) {
    window.clearTimeout(timeoutId);

    if (err instanceof Error && (err.name === 'AbortError' || isNetworkError(err))) {
      throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão ou tente novamente mais tarde.');
    }
    throw err;
  }
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>(path),
  post: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T = void>(path: string): Promise<T> => request<T>(path, { method: 'DELETE' }),
  setRequestTimeout,
};
