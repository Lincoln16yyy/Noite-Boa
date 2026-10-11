import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import Configuracoes from './Configuracoes';
import { renderWithAuth } from '../test/test-utils';
import { agendarLembrete, cancelarLembrete, lembreteAtivo, permissaoNotificacao, setLembreteAtivo } from '../lib/reminder';

vi.mock('../lib/reminder', () => ({
  agendarLembrete: vi.fn(() => true),
  cancelarLembrete: vi.fn(),
  lembreteAtivo: vi.fn(() => false),
  permissaoNotificacao: vi.fn(() => 'granted'),
  setLembreteAtivo: vi.fn(),
  suportaNotificacao: () => true,
}));


function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

const ME = { id: 'u1', email: 'ana@exemplo.com', displayName: 'Ana', timezone: 'America/Sao_Paulo' };
const GOAL = { targetMinutes: 480, bedtime: '23:00:00', wakeTime: '07:00:00' };
const mockUser = ME;

describe('tela de Configurações', () => {
  let fetchMock;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    agendarLembrete.mockClear();
    cancelarLembrete.mockClear();
    setLembreteAtivo.mockClear();
    lembreteAtivo.mockReturnValue(false);
    permissaoNotificacao.mockReturnValue('granted');
    fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options = {}) => {
      const path = String(url);
      if (path.includes('/goal') && options.method === 'PUT') {
        return jsonResponse(JSON.parse(options.body));
      }
      if (path.includes('/me') && options.method === 'PUT') {
        return jsonResponse({ ...ME, ...JSON.parse(options.body) });
      }
      if (path.includes('/me')) {
        return jsonResponse(ME);
      }
      return jsonResponse(GOAL);
    });
  });

  afterEach(() => {
    cancelarLembrete.mockClear();
    delete window.Notification;
  });

  function openScreen() {
    return renderWithAuth(<Configuracoes />, { user: mockUser, route: '/configuracoes' });
  }

  function calls(method, pathFragment) {
    return fetchMock.mock.calls.filter(([url, options]) => (options?.method ?? 'GET') === method && String(url).includes(pathFragment));
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

    expect(await screen.findByRole('status')).toHaveTextContent('Preferências salvas.');
    const put = calls('PUT', '/me')[0];
    expect(JSON.parse(put[1].body).timezone).toBe('Europe/Lisbon');
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
    permissaoNotificacao.mockReturnValue('denied');
    window.Notification = { requestPermission: vi.fn().mockResolvedValue('denied') };
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
    cancelarLembrete.mockClear();
    fireEvent.click(screen.getByLabelText(/Avisar às/));
    await waitFor(() => expect(cancelarLembrete).toHaveBeenCalled());
    expect(setLembreteAtivo).toHaveBeenCalledWith(false);
  });

  it('pede o horário de dormir quando a meta não tem', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes('/me')) return jsonResponse(ME);
      return jsonResponse({ targetMinutes: 480, bedtime: null, wakeTime: null });
    });
    openScreen();
    expect(await screen.findByText(/Defina o.*Horário de dormir/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Avisar às/)).not.toBeInTheDocument();
  });

  it('reagenda o lembrete quando o horário de dormir muda', async () => {
    lembreteAtivo.mockReturnValue(true);
    openScreen();
    fireEvent.change(await screen.findByLabelText('Horário de dormir'), { target: { value: '22:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Preferências salvas.'));
    await waitFor(() => expect(agendarLembrete).toHaveBeenCalledWith('22:30'));
  });

  it('cancela o lembrete se o horário de dormir for removido', async () => {
    lembreteAtivo.mockReturnValue(true);
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
    fetchMock.mockImplementation(async (url, options = {}) => {
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
    fetchMock.mockImplementation(async (url, options = {}) => {
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

  it('mantém a sessão e mostra erro quando a exclusão falha no servidor', async () => {
    fetchMock.mockImplementation(async (url, options = {}) => {
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
});
