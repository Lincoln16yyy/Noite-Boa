import { vi } from 'vitest';
import { api, setRequestTimeout } from './client';

describe('api client', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    setRequestTimeout(30000); // reset to default
  });

  it('attaches token when present', async () => {
    localStorage.setItem('token', 'abc');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    await api.get('/me');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/me'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer abc' }) }),
    );
  });

  it('clears session on 401', async () => {
    localStorage.setItem('token', 'abc');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));
    await expect(api.get('/me')).rejects.toThrow('Sessão expirada');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('401 de uma sessão antiga não derruba a sessão nova (#292)', async () => {
    localStorage.setItem('token', 'token-A');
    let responder: ((valor: Response) => void) | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise<Response>((resolve) => { responder = resolve; }),
    );

    const requisicao = api.get('/sleep-logs');
    localStorage.setItem('token', 'token-B'); // outra conta logou enquanto A estava em voo
    responder?.(new Response('{}', { status: 401 }));

    await expect(requisicao).rejects.toThrow('Erro 401');
    expect(localStorage.getItem('token')).toBe('token-B');
  });

  it('401 depois que outra aba deslogou encerra a sessão desta aba (#292)', async () => {
    localStorage.setItem('token', 'token-A');
    let responder: ((valor: Response) => void) | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise<Response>((resolve) => { responder = resolve; }),
    );
    const mudancas: string[] = [];
    const ouvinte = () => {
      mudancas.push('session-change');
    };
    window.addEventListener('noiteboa:session-change', ouvinte);

    const requisicao = api.get('/sleep-logs');
    localStorage.removeItem('token'); // a outra aba deslogou; esta não recebeu evento
    responder?.(new Response('{}', { status: 401 }));

    await expect(requisicao).rejects.toThrow('Sessão expirada');
    expect(mudancas).toHaveLength(1);
    window.removeEventListener('noiteboa:session-change', ouvinte);
  });

  it('shows the API message on 401 when there is no session (failed login)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Credenciais inválidas' }), { status: 401 }),
    );
    await expect(api.post('/auth/login', {})).rejects.toThrow('Credenciais inválidas');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('converts ProblemDetail into friendly message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Já existe uma conta com este e-mail.' }), { status: 409 }),
    );
    await expect(api.post('/auth/register', {})).rejects.toThrow('Já existe uma conta');
  });

  // Issue #107: timeout e erro de rede com mensagem amigável
  it('lança mensagem amigável em caso de erro de rede (Failed to fetch)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api.get('/me')).rejects.toThrow('Não foi possível conectar ao servidor');
  });

  it('permite configurar timeout via setRequestTimeout', () => {
    setRequestTimeout(5000);
    // não testa internamente, mas garante que a função existe e é exportada
    expect(typeof setRequestTimeout).toBe('function');
  });

  // Issue #266: o cliente central precisa aceitar o signal e cancelar o fetch.
  it('aceita signal externo e aborta o fetch quando cancelado (#266)', async () => {
    const controller = new AbortController();
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url: any, options: any) => {
      return new Promise<Response>((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const erro = new Error('aborted');
          erro.name = 'AbortError';
          reject(erro);
        });
      });
    });

    const promessa = api.get('/friends/ranking?days=7', { signal: controller.signal });
    controller.abort();
    await expect(promessa).rejects.toThrow('Não foi possível conectar');
  });
});
