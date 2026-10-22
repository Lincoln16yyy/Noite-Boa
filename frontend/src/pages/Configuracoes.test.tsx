import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import Configuracoes from './Configuracoes';
import { renderWithAuth } from '../test/test-utils';
import { useAuth } from '../context/AuthContext';
import { agendarLembrete, cancelarLembrete, lembreteAtivo, permissaoNotificacao, setLembreteAtivo } from '../lib/reminder';
import { comLockDeSessao } from '../lib/lock-sessao';

/** Mostra quem o contexto ainda considera logado. */
function MostraUsuario() {
  const { user } = useAuth();
  return <p>{user?.email ?? 'sem usuário'}</p>;
}

vi.mock('../lib/reminder', () => ({
  agendarLembrete: vi.fn(() => true),
  cancelarLembrete: vi.fn(),
  lembreteAtivo: vi.fn(() => false),
  permissaoNotificacao: vi.fn(() => 'granted'),
  setLembreteAtivo: vi.fn(),
  suportaNotificacao: () => true,
}));

// controla o fuso do aparelho nos testes (issue #102): o default é o do perfil
vi.mock('../lib/fuso', async (importOriginal) => ({
  ...(await importOriginal()),
  fusoDoAparelho: () => (globalThis as any).__fusoAparelho ?? 'America/Sao_Paulo',
}));


function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

const ME = { id: 'u1', email: 'ana@exemplo.com', displayName: 'Ana', timezone: 'America/Sao_Paulo' };
const GOAL = { targetMinutes: 480, bedtime: '23:00:00', wakeTime: '07:00:00' };
const mockUser = ME;

function openScreen() {
  return renderWithAuth(<Configuracoes />, { user: mockUser, route: '/configuracoes' });
}

describe('tela de Configurações', () => {
  let fetchMock: any;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    (globalThis as any).__fusoAparelho = 'America/Sao_Paulo';
    (agendarLembrete as any).mockClear();
    (cancelarLembrete as any).mockClear();
    (setLembreteAtivo as any).mockClear();
    (lembreteAtivo as any).mockReturnValue(false);
    (permissaoNotificacao as any).mockReturnValue('granted');
    fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options = {}) => {
      const path = String(url);
      if (path.includes('/goal') && options.method === 'PUT') {
        return jsonResponse(JSON.parse(options.body as any));
      }
      if (path.includes('/me') && options.method === 'PUT') {
        return jsonResponse({ ...ME, ...JSON.parse(options.body as any) });
      }
      if (path.includes('/me')) {
        return jsonResponse(ME);
      }
      return jsonResponse(GOAL);
    });
  });

  afterEach(() => {
    (cancelarLembrete as any).mockClear();
    (window as any).Notification = undefined;
  });

  function calls(method: string, pathFragment: string) {
    return fetchMock.mock.calls.filter(([url, options]: any) => (options?.method ?? 'GET') === method && String(url).includes(pathFragment));
  }

  it('carrega a meta e o fuso da API', async () => {
    openScreen();
    expect(await screen.findByLabelText('Horas por noite (4 a 12)')).toHaveValue(8);
    expect(screen.getByLabelText('Horário de dormir')).toHaveValue('23:00');
    expect(screen.getByLabelText('Fuso horário')).toHaveValue('America/Sao_Paulo');
    expect(screen.getByText(/ana@exemplo\.com/)).toBeInTheDocument();
  });

  it('salva a nova meta', async () => {
    openScreen();
    fireEvent.change(await screen.findByLabelText('Horas por noite (4 a 12)'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Preferências salvas.');
    const put = calls('PUT', '/goal')[0];
    expect(JSON.parse(put[1].body).targetMinutes).toBe(540);
  });

  it('salva o fuso alterado', async () => {
    openScreen();
    fireEvent.change(await screen.findByLabelText('Fuso horário'), { target: { value: 'Europe/Lisbon' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    // mensagem de sucesso (role=status também é usado pelo aviso de fuso, #102)
    expect(await screen.findByText('Preferências salvas.')).toBeInTheDocument();
    const put = calls('PUT', '/me')[0];
    expect(JSON.parse(put[1].body).timezone).toBe('Europe/Lisbon');
    // o perfil passou a divergir do aparelho → o aviso discreto aparece
    expect(await screen.findByRole('button', { name: 'Usar o fuso do aparelho (America/Sao_Paulo)' })).toBeInTheDocument();
  });

  it('recusa meta fora de 4 e 12 horas', async () => {
    openScreen();
    fireEvent.change(await screen.findByLabelText('Horas por noite (4 a 12)'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/entre 4 e 12/);
    expect(calls('PUT', '/goal').length).toBe(0);
  });

  it('sai da conta limpando a sessão', async () => {
    openScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Sair da conta' }));

    await waitFor(() => expect(localStorage.getItem('token')).toBeNull());
  });

  it('mostra erro e não navega quando o logout falha (#310)', async () => {
    renderWithAuth(
      <Routes>
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="/login" element={<p>tela de login</p>} />
      </Routes>,
      { user: mockUser, route: '/configuracoes' },
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage bloqueado');
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Sair da conta' }));

    // Sem o token removido, navegar para /login faria o Layout devolver para
    // /hoje — o clique pareceria não ter feito nada (#310).
    expect(await screen.findByText('Não foi possível sair. Tente de novo.')).toBeInTheDocument();
    expect(screen.queryByText('tela de login')).not.toBeInTheDocument();
    expect(localStorage.getItem('token')).toBe('mock-token');
  });

  it('espera o lock antes de navegar no logout (#293)', async () => {
    renderWithAuth(
      <Routes>
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="/login" element={<p>tela de login</p>} />
      </Routes>,
      { user: mockUser, route: '/configuracoes' },
    );
    expect(await screen.findByRole('heading', { name: 'Configurações' })).toBeInTheDocument();

    // Outra aba está com o lock: o logout espera e não pode navegar antes de
    // limpar a sessão, senão o Layout devolve a pessoa para /hoje (#293).
    let liberar!: () => void;
    const segurando = new Promise<void>((resolver) => {
      liberar = resolver;
    });
    const dono = comLockDeSessao(() => segurando);

    fireEvent.click(screen.getByRole('button', { name: 'Sair da conta' }));
    expect(localStorage.getItem('token')).toBe('mock-token');
    // Ainda não navegou: com o lock preso, o logout não terminou.
    expect(screen.queryByText('tela de login')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Configurações' })).toBeInTheDocument();

    liberar();
    await dono;
    expect(await screen.findByText('tela de login')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('sair da conta derruba o usuário do contexto, não só o token (#292)', async () => {
    // /me só responde com Authorization, como no back-end real.
    fetchMock.mockImplementation(async (url: any, options: any = {}) => {
      if (String(url).includes('/me')) {
        return options.headers?.Authorization
          ? jsonResponse(ME)
          : jsonResponse({ detail: 'não autenticado' }, 401);
      }
      return jsonResponse(GOAL);
    });

    renderWithAuth(
      <>
        <Configuracoes />
        <MostraUsuario />
      </>,
      { user: mockUser, route: '/configuracoes' },
    );

    expect(await screen.findByText('ana@exemplo.com')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Sair da conta' }));

    // Com só `clearSession` o contexto continuaria com o usuário e o Layout
    // devolveria /login para /hoje: a pessoa saía do token, mas não do app.
    expect(await screen.findByText('sem usuário')).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem('token')).toBeNull());
  });

  it('explica as limitações do lembrete na tela', async () => {
    openScreen();
    expect(await screen.findByText(/não é um alarme/i)).toBeInTheDocument();
    expect(screen.getByText(/navegadores não garantem/i)).toBeInTheDocument();
  });

  it('ativa o lembrete pedindo permissão só no clique', async () => {
    openScreen();
    fireEvent.click(await screen.findByLabelText(/Avisar às/));
    await waitFor(() => expect(agendarLembrete).toHaveBeenCalledWith('23:00'));
    expect(setLembreteAtivo).toHaveBeenCalledWith(true);
  });

  it('não ativa o lembrete quando a notificação é negada', async () => {
    (permissaoNotificacao as any).mockReturnValue('denied');
    (window as any).Notification = { requestPermission: vi.fn().mockResolvedValue('denied') };
    openScreen();
    fireEvent.click(await screen.findByLabelText(/Avisar às/));
    await waitFor(() =>
      expect(screen.getByText(/Notificação bloqueada/)).toBeInTheDocument(),
    );
    expect(agendarLembrete).not.toHaveBeenCalled();
    expect(setLembreteAtivo).not.toHaveBeenCalled();
  });

  it('desativa o lembrete ao desmarcar', async () => {
    openScreen();
    fireEvent.click(await screen.findByLabelText(/Avisar às/));
    await waitFor(() => expect(agendarLembrete).toHaveBeenCalled());
    (cancelarLembrete as any).mockClear();
    fireEvent.click(screen.getByLabelText(/Avisar às/));
    await waitFor(() => expect(cancelarLembrete).toHaveBeenCalled());
    expect(setLembreteAtivo).toHaveBeenCalledWith(false);
  });

  it('pede o horário de dormir quando a meta não tem', async () => {
    fetchMock.mockImplementation(async (url: any) => {
      if (String(url).includes('/me')) return jsonResponse(ME);
      return jsonResponse({ targetMinutes: 480, bedtime: null, wakeTime: null });
    });
    openScreen();
    expect(await screen.findByText(/Defina o.*Horário de dormir/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Avisar às/)).not.toBeInTheDocument();
  });

  it('reagenda o lembrete quando o horário de dormir muda', async () => {
    (lembreteAtivo as any).mockReturnValue(true);
    openScreen();
    fireEvent.change(await screen.findByLabelText('Horário de dormir'), { target: { value: '22:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Preferências salvas.'));
    await waitFor(() => expect(agendarLembrete).toHaveBeenCalledWith('22:30'));
  });

  it('cancela o lembrete se o horário de dormir for removido', async () => {
    (lembreteAtivo as any).mockReturnValue(true);
    openScreen();
    fireEvent.change(await screen.findByLabelText('Horário de dormir'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(cancelarLembrete).toHaveBeenCalled());
  });

  it('mostra a seção de excluir conta', async () => {
    openScreen();
    expect(await screen.findByText('Excluir conta')).toBeInTheDocument();
    expect(screen.getByText(/irreversível/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('seu@email.com ou EXCLUIR')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Excluir minha conta' })).toBeInTheDocument();
  });

  it('recusa exclusão com confirmação inválida', async () => {
    openScreen();
    fireEvent.change(await screen.findByPlaceholderText('seu@email.com ou EXCLUIR'), { target: { value: 'errado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir minha conta' }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0]).toHaveTextContent(/Digite seu e-mail ou "EXCLUIR"/);
    expect(calls('DELETE', '/me').length).toBe(0);
    expect(localStorage.getItem('token')).toBe('mock-token');
  });

  it('exclui a conta com confirmação por e-mail e leva para a página inicial', async () => {
    fetchMock.mockImplementation(async (url: any, options: any = {}) => {
      const path = String(url);
      if (path.includes('/me') && options.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }
      if (path.includes('/me')) return jsonResponse(ME);
      return jsonResponse(GOAL);
    });
    renderWithAuth(
      <Routes>
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="/" element={<h1>Página inicial</h1>} />
      </Routes>,
      { user: mockUser, route: '/configuracoes' },
    );
    fireEvent.change(await screen.findByPlaceholderText('seu@email.com ou EXCLUIR'), { target: { value: 'ana@exemplo.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir minha conta' }));
    await waitFor(() => expect(calls('DELETE', '/me').length).toBe(1));
    expect(await screen.findByRole('heading', { name: 'Página inicial' })).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('exclusão sem lock não derruba a sessão de outra aba e avisa que a local ficou pendente (#310)', async () => {
    fetchMock.mockImplementation(async (url: any, options: any = {}) => {
      const path = String(url);
      if (path.includes('/me') && options.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }
      if (path.includes('/me')) return jsonResponse(ME);
      return jsonResponse(GOAL);
    });
    renderWithAuth(
      <Routes>
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="/" element={<h1>Página inicial</h1>} />
      </Routes>,
      { user: mockUser, route: '/configuracoes' },
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const nav = navigator as unknown as { locks?: LockManager };
    const original = nav.locks;
    const request = vi.fn().mockRejectedValue(new Error('lock fora do ar'));
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request },
    });

    try {
      fireEvent.change(await screen.findByPlaceholderText('seu@email.com ou EXCLUIR'), { target: { value: 'EXCLUIR' } });
      fireEvent.click(screen.getByRole('button', { name: 'Excluir minha conta' }));

      // A conta já não existe no servidor. Sem lock, remover o token seria uma
      // corrida com outra aba: a tela avisa que a sessão local ficou pendente
      // em vez de arriscar derrubar a conta nova (#310).
      await waitFor(() => expect(calls('DELETE', '/me').length).toBe(1));
      expect(
        await screen.findByText(/Conta excluída, mas não foi possível encerrar a sessão/),
      ).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Página inicial' })).not.toBeInTheDocument();
      expect(localStorage.getItem('token')).not.toBeNull();
      // A mensagem não pode vir de um caminho que nem chegou a pedir o lock:
      // 2 tentativas na primeira limpeza + 2 na nova tentativa.
      expect(request).toHaveBeenCalledTimes(4);
    } finally {
      Object.defineProperty(navigator, 'locks', { configurable: true, value: original });
    }
  });

  it('exclusão com a sessão reaberta avisa em vez de ficar em silêncio (#310)', async () => {
    let responderDelete: ((valor: Response) => void) | undefined;
    fetchMock.mockImplementation(async (url: any, options: any = {}) => {
      const path = String(url);
      if (path.includes('/me') && options.method === 'DELETE') {
        return new Promise<Response>((resolve) => {
          responderDelete = resolve;
        });
      }
      if (path.includes('/me')) return jsonResponse(ME);
      return jsonResponse(GOAL);
    });
    renderWithAuth(
      <Routes>
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="/" element={<h1>Página inicial</h1>} />
      </Routes>,
      { user: mockUser, route: '/configuracoes' },
    );
    fireEvent.change(await screen.findByPlaceholderText('seu@email.com ou EXCLUIR'), {
      target: { value: 'EXCLUIR' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir minha conta' }));

    // O DELETE está em voo; outra aba reabre a sessão com o mesmo token (nova
    // geração). A limpeza não pode derrubar essa sessão, mas a exclusão já
    // aconteceu no servidor — a tela precisa dizer isso (#310).
    await waitFor(() => expect(responderDelete).toBeDefined());
    localStorage.setItem('noiteboa-sessao-geracao', 'geracao-nova');
    await act(async () => {
      responderDelete?.(new Response(null, { status: 204 }));
    });

    expect(
      await screen.findByText(/Conta excluída, mas a sessão local não foi encerrada/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Página inicial' })).not.toBeInTheDocument();
    expect(localStorage.getItem('token')).not.toBeNull();
  });

  it('storage bloqueado na exclusão avisa que não conseguiu encerrar a sessão (#310)', async () => {
    fetchMock.mockImplementation(async (url: any, options: any = {}) => {
      const path = String(url);
      if (path.includes('/me') && options.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }
      if (path.includes('/me')) return jsonResponse(ME);
      return jsonResponse(GOAL);
    });
    renderWithAuth(
      <Routes>
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="/" element={<h1>Página inicial</h1>} />
      </Routes>,
      { user: mockUser, route: '/configuracoes' },
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage bloqueado');
    });

    fireEvent.change(await screen.findByPlaceholderText('seu@email.com ou EXCLUIR'), { target: { value: 'EXCLUIR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir minha conta' }));

    await waitFor(() => expect(calls('DELETE', '/me').length).toBe(1));
    expect(
      await screen.findByText(/Conta excluída, mas não foi possível encerrar a sessão/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Página inicial' })).not.toBeInTheDocument();
    expect(localStorage.getItem('token')).not.toBeNull();
  });

  it('exclui a conta com confirmação EXCLUIR', async () => {    fetchMock.mockImplementation(async (url: any, options: any = {}) => {
      const path = String(url);
      if (path.includes('/me') && options.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }
      if (path.includes('/me')) return jsonResponse(ME);
      return jsonResponse(GOAL);
    });
    openScreen();
    fireEvent.change(await screen.findByPlaceholderText('seu@email.com ou EXCLUIR'), { target: { value: 'EXCLUIR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir minha conta' }));
    await waitFor(() => expect(calls('DELETE', '/me').length).toBe(1));
    await waitFor(() => expect(localStorage.getItem('token')).toBeNull());
  });

  it('exclusão da conta não derruba a sessão que entrou durante o pedido (#292)', async () => {
    let responderDelete: ((resposta: Response) => void) | undefined;
    fetchMock.mockImplementation(async (url: any, options: any = {}) => {
      const path = String(url);
      if (path.includes('/me') && options.method === 'DELETE') {
        return new Promise<Response>((resolve) => {
          responderDelete = resolve;
        });
      }
      if (path.includes('/me')) return jsonResponse(ME);
      return jsonResponse(GOAL);
    });
    renderWithAuth(
      <Routes>
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="/" element={<h1>Página inicial</h1>} />
      </Routes>,
      { user: mockUser, route: '/configuracoes' },
    );
    fireEvent.change(await screen.findByPlaceholderText('seu@email.com ou EXCLUIR'), {
      target: { value: 'EXCLUIR' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir minha conta' }));

    // O DELETE está em voo; outra aba entra com a conta B.
    await waitFor(() => expect(responderDelete).toBeDefined());
    localStorage.setItem('token', 'jwt-B');
    await act(async () => {
      responderDelete?.(new Response(null, { status: 204 }));
    });

    // Espera o handler retomar (libera o botão) antes de conferir: a guarda
    // roda depois do `await`, não no clique.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Excluir minha conta' })).toBeEnabled(),
    );
    // A sessão nova continua de pé e não é levada para a página de exclusão.
    expect(localStorage.getItem('token')).toBe('jwt-B');
    expect(screen.queryByRole('heading', { name: 'Página inicial' })).not.toBeInTheDocument();
  });

  it('não envia a exclusão se a tela é de outra sessão (#292)', async () => {
    fetchMock.mockImplementation(async (url: any, options: any = {}) => {
      const path = String(url);
      if (path.includes('/me') && options.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }
      if (path.includes('/me')) return jsonResponse(ME);
      return jsonResponse(GOAL);
    });
    renderWithAuth(<Configuracoes />, { user: mockUser, route: '/configuracoes' });
    fireEvent.change(await screen.findByPlaceholderText('seu@email.com ou EXCLUIR'), {
      target: { value: 'EXCLUIR' },
    });

    // Outra aba trocou a conta e o evento `storage` ainda não chegou: o perfil
    // na tela é de A, e o DELETE sairia como B.
    localStorage.setItem('token', 'jwt-B');
    fireEvent.click(screen.getByRole('button', { name: 'Excluir minha conta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/sessão mudou/i);
    expect(calls('DELETE', '/me').length).toBe(0);
    expect(localStorage.getItem('token')).toBe('jwt-B');
  });

  it('mantém a sessão e mostra erro quando a exclusão falha no servidor', async () => {
    fetchMock.mockImplementation(async (url: any, options: any = {}) => {
      const path = String(url);
      if (path.includes('/me') && options.method === 'DELETE') {
        return jsonResponse({ detail: 'Erro interno. Tente novamente.' }, 500);
      }
      if (path.includes('/me')) return jsonResponse(ME);
      return jsonResponse(GOAL);
    });
    openScreen();
    fireEvent.change(await screen.findByPlaceholderText('seu@email.com ou EXCLUIR'), { target: { value: 'EXCLUIR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir minha conta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Erro interno. Tente novamente.');
    // A sessão local não pode ser apagada quando o servidor falha
    expect(localStorage.getItem('token')).toBe('mock-token');
    expect(screen.getByRole('button', { name: 'Excluir minha conta' })).toBeEnabled();
  });

  it('mostra o aviso quando o fuso do aparelho difere do perfil (issue #102)', async () => {
    (globalThis as any).__fusoAparelho = 'Asia/Tokyo'; // perfil: America/Sao_Paulo
    openScreen();

    const aviso = await screen.findByText(/Este aparelho está em/);
    expect(aviso).toHaveTextContent('Este aparelho está em Asia/Tokyo');
    expect(aviso).toHaveTextContent('mas seu perfil usa America/Sao_Paulo');

    fireEvent.click(screen.getByRole('button', { name: 'Usar o fuso do aparelho (Asia/Tokyo)' }));
    await waitFor(() => expect(calls('PUT', '/me').length).toBe(1));
    const body = JSON.parse(calls('PUT', '/me')[0][1].body);
    expect(body).toEqual({ timezone: 'Asia/Tokyo' });
    expect(await screen.findByText('Fuso horário atualizado para o do aparelho.')).toBeInTheDocument();
    // sumiu depois de atualizado (mesmo aparelho, agora igual ao perfil)
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Usar o fuso do aparelho/ })).not.toBeInTheDocument(),
    );
  });

  it('não mostra o aviso quando os fusos são iguais (issue #102)', async () => {
    (globalThis as any).__fusoAparelho = 'America/Sao_Paulo'; // igual ao perfil
    openScreen();

    await screen.findByText('Fuso horário');
    expect(screen.queryByRole('button', { name: /Usar o fuso do aparelho/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Este aparelho está em/)).not.toBeInTheDocument();
  });
  it('não salva metas/fuso se a tela é de outra sessão (#298)', async () => {
    openScreen();
    await screen.findByDisplayValue('8');
    // Fuso diferente do carregado: o caminho do `PUT /me` seria exercitado.
    fireEvent.change(screen.getByLabelText('Fuso horário'), { target: { value: 'Europe/Lisbon' } });

    // Outra aba trocou a conta; o evento `storage` ainda não chegou.
    localStorage.setItem('token', 'jwt-B');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/sessão mudou/i);
    expect(calls('PUT', '/goal').length).toBe(0);
    expect(calls('PUT', '/me').length).toBe(0);
    expect(localStorage.getItem('token')).toBe('jwt-B');
  });

  it('não comita o perfil se outra conta assumiu durante a carga (#298)', async () => {
    let chamadasMe = 0;
    const liberar: Array<() => void> = [];
    fetchMock.mockImplementation(async (url: any) => {
      const path = String(url);
      if (path.includes('/me')) {
        chamadasMe += 1;
        // A 1ª é a carga da tela; a 2ª é o /me do AuthContext, que resolve
        // antes para não disparar sozinho a troca de sessão.
        if (chamadasMe === 1) {
          await new Promise<void>((resolve) => {
            liberar.push(resolve);
          });
        }
        return jsonResponse(ME);
      }
      await new Promise<void>((resolve) => {
        liberar.push(resolve);
      });
      return jsonResponse(GOAL);
    });

    openScreen();
    await waitFor(() => expect(chamadasMe).toBeGreaterThanOrEqual(2));
    localStorage.setItem('token', 'jwt-B');
    await act(async () => {
      liberar.forEach((fn) => fn());
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/sessão mudou/i);
    // Se o perfil de B fosse comitado, a meta (8h) apareceria preenchida.
    expect(screen.queryByDisplayValue('8')).not.toBeInTheDocument();
  });

  it('avisa quando o fuso salvou e a meta falhou (#298)', async () => {
    fetchMock.mockImplementation(async (url: any, options: any = {}) => {
      const path = String(url);
      if (path.includes('/me') && options.method === 'PUT') {
        return jsonResponse({ ...ME, ...JSON.parse(options.body as any) });
      }
      if (path.includes('/goal') && options.method === 'PUT') {
        return jsonResponse({ detail: 'Erro interno.' }, 500);
      }
      if (path.includes('/me')) return jsonResponse(ME);
      return jsonResponse(GOAL);
    });

    openScreen();
    await screen.findByDisplayValue('8');
    fireEvent.change(screen.getByLabelText('Fuso horário'), { target: { value: 'Europe/Lisbon' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(/fuso horário foi atualizado/i);
    expect(alerta).toHaveTextContent('Erro interno.');
  });

  it('limpa a confirmação de exclusão quando a sessão muda (#298)', async () => {
    openScreen();
    await screen.findByDisplayValue('8');
    const campo = screen.getByPlaceholderText('seu@email.com ou EXCLUIR');
    fireEvent.change(campo, { target: { value: 'EXCLUIR' } });

    localStorage.setItem('token', 'jwt-B');
    await act(async () => {
      window.dispatchEvent(new CustomEvent('noiteboa:session-change'));
    });

    // O "EXCLUIR" digitado para A não vale para a conta que acabou de entrar.
    // (O campo some no "Carregando…" e volta vazio com o perfil novo.)
    expect(await screen.findByPlaceholderText('seu@email.com ou EXCLUIR')).toHaveValue('');
  });

  it('não mantém as preferências da sessão anterior se a nova carga falha (#298)', async () => {
    openScreen();
    await screen.findByDisplayValue('8');

    fetchMock.mockImplementation(async (url: any) => {
      if (String(url).includes('/me')) return jsonResponse(ME);
      return jsonResponse({ detail: 'Erro interno.' }, 500);
    });
    localStorage.setItem('token', 'jwt-B');
    await act(async () => {
      window.dispatchEvent(new CustomEvent('noiteboa:session-change'));
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Erro interno.');
    // A meta de 8h de A não fica pronta para ser salva em B.
    expect(screen.queryByDisplayValue('8')).not.toBeInTheDocument();
  });

});
