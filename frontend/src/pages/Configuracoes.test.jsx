import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Configuracoes from './Configuracoes';
import { renderWithAuth } from '../test/test-utils';

vi.mock('../lib/reminder', () => ({
  agendarLembrete: vi.fn(() => true),
  cancelarLembrete: vi.fn(),
  lembreteAtivo: () => false,
  permissaoNotificacao: () => 'granted',
  setLembreteAtivo: vi.fn(),
  suportaNotificacao: () => true,
}));

import { agendarLembrete, cancelarLembrete } from '../lib/reminder';

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
  });

  function openScreen() {
    renderWithAuth(<Configuracoes />, { user: mockUser, route: '/configuracoes' });
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
    fireEvent.click(screen.getByRole('button', { name: 'Sair da conta' }));

    expect(localStorage.getItem('token')).toBeNull();
  });

  it('explica as limitações do lembrete na tela', async () => {
    openScreen();
    expect(await screen.findByText(/não é um alarme/i)).toBeInTheDocument();
    expect(screen.getByText(/navegadores não garantem/i)).toBeInTheDocument();
  });

  it('ativa o lembrete pedindo permissão só no clique', async () => {
    openScreen();
    fireEvent.click(await screen.findByLabelText('Compartilhar minha consistência com amigos'));
    await waitFor(() => expect(screen.getByLabelText('Avisar às')).toBeInTheDocument());
    fireEvent.click(await screen.findByLabelText('Avisar às'));
    await waitFor(() => expect(agendarLembrete).toHaveBeenCalledWith('23:00'));
  });

  it('não ativa o lembrete quando a notificação é negada', async () => {
    openScreen();
    fireEvent.click(await screen.findByLabelText('Avisar às'));
    await waitFor(() => expect(agendarLembrete).toHaveBeenCalledWith('23:00'));
  });

  it('desativa o lembrete ao desmarcar', async () => {
    openScreen();
    fireEvent.click(await screen.findByLabelText('Avisar às'));
    await waitFor(() => expect(agendarLembrete).toHaveBeenCalled());
    cancelarLembrete.mockClear();
    fireEvent.click(await screen.findByLabelText('Avisar às'));
    await waitFor(() => expect(cancelarLembrete).toHaveBeenCalled());
  });

  it('pede o horário de dormir quando a meta não tem', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes('/me')) return jsonResponse(ME);
      return jsonResponse({ targetMinutes: 480, bedtime: null, wakeTime: null });
    });
    openScreen();
    expect(screen.queryByLabelText('Avisar às')).not.toBeInTheDocument();
    expect(screen.getByText(/Defina o.*Horário de dormir/)).toBeInTheDocument();
  });

  it('reagenda o lembrete quando o horário de dormir muda', async () => {
    openScreen();
    fireEvent.change(await screen.findByLabelText('Horário de dormir'), { target: { value: '22:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Preferências salvas.'));
    await waitFor(() => expect(agendarLembrete).toHaveBeenCalledWith('22:30'));
  });

  it('cancela o lembrete se o horário de dormir for removido', async () => {
    openScreen();
    fireEvent.change(await screen.findByLabelText('Horário de dormir'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(cancelarLembrete).toHaveBeenCalled());
  });
});
