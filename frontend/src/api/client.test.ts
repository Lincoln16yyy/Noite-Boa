import { vi } from 'vitest';
import { api, setTimeout } from './client';

describe('api client', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    setTimeout(30000); // reset to default
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

  it('permite configurar timeout via setTimeout', () => {
    setTimeout(5000);
    // não testa internamente, mas garante que a função existe e é exportada
    expect(typeof setTimeout).toBe('function');
  });
});
