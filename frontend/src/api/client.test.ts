import { vi } from 'vitest';
import {
  api,
  clearSessionIfCurrent,
  getSessionGeneration,
  saveSession,
  setRequestTimeout,
} from './client';
import { comLockDeSessao } from '../lib/lock-sessao';

/** Segura o lock e devolve a função que libera, para enfileirar operações. */
function segurarLock() {
  let liberar!: () => void;
  const segurando = new Promise<void>((resolver) => {
    liberar = resolver;
  });
  const dono = comLockDeSessao(() => segurando);
  return { dono, liberar };
}

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

  it('usa o token explícito sem mandá-lo ao fetch (#298)', async () => {
    localStorage.setItem('token', 'token-B');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await api.put('/goal', { targetMinutes: 480 }, { token: 'token-A' });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>).Authorization).toBe('Bearer token-A');
    expect(options).not.toHaveProperty('token');
    expect(localStorage.getItem('token')).toBe('token-B');
  });

  it('401 do token explícito de uma sessão antiga não derruba a nova (#298)', async () => {
    localStorage.setItem('token', 'token-B');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));
    const mudancas: string[] = [];
    const ouvinte = () => {
      mudancas.push('session-change');
    };
    window.addEventListener('noiteboa:session-change', ouvinte);

    try {
      await expect(api.put('/goal', {}, { token: 'token-A' })).rejects.toThrow('Erro 401');
    } finally {
      window.removeEventListener('noiteboa:session-change', ouvinte);
    }

    expect(localStorage.getItem('token')).toBe('token-B');
    // Sem evento, o AuthContext desta aba não derruba o usuário da conta nova.
    expect(mudancas).toHaveLength(0);
  });

  it('clears session on 401', async () => {
    localStorage.setItem('token', 'abc');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));
    await expect(api.get('/me')).rejects.toThrow('Sessão expirada');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('lock fora do ar no 401 ainda reporta sessão expirada, sem apagar o token (#310)', async () => {
    localStorage.setItem('token', 'abc');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));
    const nav = navigator as unknown as { locks?: LockManager };
    const original = nav.locks;
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request: vi.fn().mockRejectedValue(new Error('lock fora do ar')) },
    });

    try {
      await expect(api.get('/me')).rejects.toThrow('Sessão expirada');
      // A limpeza fica para a próxima operação com lock; o 401 não pode virar
      // erro de lock nem sumir com um token que ainda pode ser usado (#310).
      expect(localStorage.getItem('token')).toBe('abc');
    } finally {
      Object.defineProperty(navigator, 'locks', { configurable: true, value: original });
    }
  });

  it('401 antigo não acusa a sessão nova de expirada quando o lock falha (#310)', async () => {
    localStorage.setItem('token', 'token-A');
    let responder: ((valor: Response) => void) | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          responder = resolve;
        }),
    );
    const rejeitores: Array<(erro: unknown) => void> = [];
    const request = vi.fn(
      () =>
        new Promise((_resolve, reject) => {
          rejeitores.push(reject);
        }),
    );
    const nav = navigator as unknown as { locks?: LockManager };
    const original = nav.locks;
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });

    try {
      const requisicao = api.get('/sleep-logs');
      responder?.(new Response('{}', { status: 401 }));

      // A limpeza começa com o token A; outra aba assume B antes de o lock
      // responder.
      while (rejeitores.length < 1) await Promise.resolve();
      localStorage.setItem('token', 'token-B');
      rejeitores[0](new Error('lock fora do ar'));
      while (rejeitores.length < 2) await Promise.resolve();
      rejeitores[1](new Error('lock fora do ar'));

      await expect(requisicao).rejects.toThrow('Erro 401');
      expect(localStorage.getItem('token')).toBe('token-B');
    } finally {
      Object.defineProperty(navigator, 'locks', { configurable: true, value: original });
    }
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

describe('escritas do token entre abas (#293)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('limpeza que espera o lock relê o token e não derruba a conta nova', async () => {
    localStorage.setItem('token', 'token-A');
    const { dono, liberar } = segurarLock();

    // A limpeza entra na fila antes de B existir. Sem o lock, a conferência
    // aconteceria agora (token A) e o `removeItem` apagaria B depois (#292).
    const limpeza = clearSessionIfCurrent('token-A');
    localStorage.setItem('token', 'token-B');
    liberar();

    await dono;
    await expect(limpeza).resolves.toBe(false);
    expect(localStorage.getItem('token')).toBe('token-B');
  });

  it('login espera o lock para não gravar no meio de uma limpeza', async () => {
    const { dono, liberar } = segurarLock();

    const escrita = saveSession('token-B');
    await Promise.resolve();
    expect(localStorage.getItem('token')).toBeNull();

    liberar();
    await dono;
    await escrita;
    expect(localStorage.getItem('token')).toBe('token-B');
  });

  it('conclui a limpeza dentro do lock, antes de outra aba gravar (#310)', async () => {
    localStorage.setItem('token', 'token-A');
    const { dono, liberar } = segurarLock();
    const ordem: string[] = [];

    const limpeza = clearSessionIfCurrent('token-A', () => {
      ordem.push(`aviso:${localStorage.getItem('token')}`);
    });
    const escrita = saveSession('token-B').then(() => ordem.push('conta-B'));

    liberar();
    await dono;
    await expect(limpeza).resolves.toBe(true);
    await escrita;

    // O aviso roda ainda com o lock preso, antes de a conta nova conseguir
    // gravar: ela não pode receber a mensagem de exclusão da conta antiga.
    expect(ordem).toEqual(['aviso:null', 'conta-B']);
    expect(localStorage.getItem('token')).toBe('token-B');
  });

  it('falha ao gravar a geração não deixa troca de token pela metade (#310)', async () => {
    const setItemOriginal = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      chave: string,
      valor: string,
    ) {
      if (chave === 'noiteboa-sessao-geracao') throw new Error('storage cheio');
      return setItemOriginal.call(this, chave, valor);
    });

    try {
      // Geração primeiro: se ela não puder ser gravada, o login falha sem
      // deixar um token que um pedido antigo poderia sobrescrever.
      await expect(saveSession('token-A')).rejects.toThrow('storage cheio');
      expect(localStorage.getItem('token')).toBeNull();

      localStorage.setItem('token', 'token-A');
      await expect(clearSessionIfCurrent('token-A')).rejects.toThrow('storage cheio');
      expect(localStorage.getItem('token')).toBe('token-A');
    } finally {
      vi.mocked(Storage.prototype.setItem).mockRestore();
    }
  });

  it('logout antigo não apaga a sessão reaberta com o mesmo token (#310)', async () => {
    await saveSession('token-A');
    const { dono, liberar } = segurarLock();
    const limpeza = clearSessionIfCurrent('token-A');

    // Outra aba saiu e entrou de novo com o MESMO token enquanto a limpeza
    // esperava o lock: a geração mudou, então ela não pode apagar a sessão nova.
    localStorage.removeItem('token');
    localStorage.setItem('token', 'token-A');
    localStorage.setItem('noiteboa-sessao-geracao', 'geracao-nova');
    liberar();
    await dono;

    await expect(limpeza).resolves.toBe(false);
    expect(localStorage.getItem('token')).toBe('token-A');
  });

  it('401 atrasado sem token não invalida o login em voo (#310)', async () => {
    const geracaoDoPedido = getSessionGeneration();

    // A requisição antiga volta 401 quando outra aba já deslogou: não há token
    // para limpar, então a geração não pode mudar.
    await expect(clearSessionIfCurrent(null)).resolves.toBe(true);

    await expect(saveSession('token-novo', geracaoDoPedido)).resolves.toBe(true);
    expect(localStorage.getItem('token')).toBe('token-novo');
  });

  it('login cuja geração mudou enquanto esperava não grava o token (#310)', async () => {
    const geracaoDoPedido = getSessionGeneration();
    await saveSession('token-A');
    // Outra aba saiu (ou entrou) enquanto a resposta do login estava em voo.
    await clearSessionIfCurrent('token-A');

    await expect(saveSession('token-B', geracaoDoPedido)).resolves.toBe(false);
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('sem Web Locks continua funcionando direto (navegador antigo)', async () => {
    const nav = navigator as unknown as { locks?: LockManager };
    const locks = nav.locks;
    delete nav.locks;

    try {
      await saveSession('token-A');
      await expect(clearSessionIfCurrent('token-B')).resolves.toBe(false);
      expect(localStorage.getItem('token')).toBe('token-A');

      await expect(clearSessionIfCurrent('token-A')).resolves.toBe(true);
      expect(localStorage.getItem('token')).toBeNull();
    } finally {
      if (locks) Object.defineProperty(navigator, 'locks', { configurable: true, value: locks });
      else delete nav.locks;
    }
  });
});
