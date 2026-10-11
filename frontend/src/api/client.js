const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

/** Tempo padrão de timeout (ms) — pode ser alterado via `api.setTimeout(ms)` */
let requestTimeout = 30000;

function getToken() {
  return localStorage.getItem('token');
}

export function clearSession() {
  localStorage.removeItem('token');
}

/** Configura o timeout global (ms) — usado em testes para simular timeout rápido. */
export function setTimeout(ms) {
  requestTimeout = ms;
}

async function readProblemMessage(response) {
  try {
    const problem = await response.json();
    if (problem.detail) return problem.detail;
    if (problem.title) return problem.title;
  } catch {
    // corpo não é ProblemDetail: mantém mensagem genérica
  }
  return '';
}

function isNetworkError(error) {
  return error instanceof TypeError && error.message === 'Failed to fetch';
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Permite passar signal externo para cancelamento (ex.: AbortController do efeito React)
  const externalSignal = options.signal;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

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

    clearTimeout(timeoutId);

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

    if (response.status === 204) return null;
    return response.json();
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError' || isNetworkError(err)) {
      throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão ou tente novamente mais tarde.');
    }
    throw err;
  }
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
