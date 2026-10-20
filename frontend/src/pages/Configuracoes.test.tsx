import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import Configuracoes from './Configuracoes';
import { renderWithAuth } from '../test/test-utils';
import { useAuth } from '../context/AuthContext';
import { agendarLembrete, cancelarLembrete, lembreteAtivo, permissaoNotificacao, setLembreteAtivo } from '../lib/reminder';

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
    expect(localStorage.getItem('token')).toBeNull();
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

  it('exclui a conta com confirmação EXCLUIR', async () => {
    fetchMock.mockImplementation(async (url: any, options: any = {}) => {
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
});
