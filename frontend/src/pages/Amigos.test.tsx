import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Amigos from './Amigos';
import { renderWithAuth } from '../test/test-utils';

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status }) as any;
}

const ME = {
  id: 'u1',
  email: 'ana@exemplo.com',
  displayName: 'Ana',
  timezone: 'America/Sao_Paulo',
  shareWithFriends: false,
};

const AMIGOS = [
  { id: 'f1', displayName: 'Bruno', email: 'bruno@exemplo.com', sharesData: true },
  { id: 'f2', displayName: 'Carla', email: 'carla@exemplo.com', sharesData: false },
];

const CONVITES = {
  sent: [{ id: 's1', friend: { id: 'u9', displayName: 'Elisa', email: 'elisa@exemplo.com' }, createdAt: '2026-10-10T01:00:00Z' }],
  received: [{ id: 'r1', friend: { id: 'u8', displayName: 'Davi', email: 'davi@exemplo.com' }, createdAt: '2026-10-10T01:00:00Z' }],
};

const RANKING_7 = {
  days: 7,
  ranking: [
    { userId: 'u2', displayName: 'Bruno', isMe: false, consistencyPercent: 86, nights: 6 },
    { userId: 'u1', displayName: 'Ana', isMe: true, consistencyPercent: 43, nights: 3 },
  ],
};

const RANKING_30 = {
  days: 30,
  ranking: [{ userId: 'u1', displayName: 'Ana', isMe: true, consistencyPercent: 70, nights: 21 }],
};

const mockUser = ME;

function openScreen() {
  renderWithAuth(<Amigos />, { user: mockUser, route: '/amigos' });
}

describe('tela de Amigos', () => {
  let fetchMock: any;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, options: any = {}) => {
      const path = String(url);
      const method = options.method ?? 'GET';
      if (path.includes('/api/me') && method === 'PUT') {
        return jsonResponse({ ...ME, ...JSON.parse(options.body) });
      }
      if (path.includes('/api/me')) return jsonResponse(ME);
      if (path.includes('/friends/requests') && method === 'POST') {
        return jsonResponse({ id: 'n1', status: 'pending', friend: { id: 'u7', displayName: 'Fábio', email: 'fabio@exemplo.com' } });
      }
      if (path.includes('/friends/requests') && method === 'DELETE') return new Response(null, { status: 204 });
      if (path.includes('/friends/requests')) return jsonResponse(CONVITES);
      if (path.includes('/friends/ranking?days=30')) return jsonResponse(RANKING_30);
      if (path.includes('/friends/ranking')) return jsonResponse(RANKING_7);
      if (path.includes('/api/friends') && method === 'DELETE') return new Response(null, { status: 204 });
      if (path.includes('/api/friends')) return jsonResponse(AMIGOS);
      return jsonResponse({});
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function calls(method: string, pathFragment: string) {
    return fetchMock.mock.calls.filter(
      ([url, options]: any) => (options?.method ?? 'GET') === method && String(url).includes(pathFragment),
    );
  }

  it('lista amigos e avisa quem não compartilha, sem métrica', async () => {
    openScreen();
    const regiao = await screen.findByRole('region', { name: 'Meus amigos' });
    expect(within(regiao).getByText('Bruno')).toBeInTheDocument();
    expect(within(regiao).getByText('Carla')).toBeInTheDocument();
    expect(within(regiao).getByText('não compartilha dados')).toBeInTheDocument();
    // dentro da lista de amigos não há métrica nenhuma (privacidade)
    expect(within(regiao).queryByText(/%/)).not.toBeInTheDocument();
    expect(within(regiao).queryByText(/noite/)).not.toBeInTheDocument();
  });

  it('mostra convites recebidos e enviados', async () => {
    openScreen();
    expect(await screen.findByText('Davi')).toBeInTheDocument();
    expect(screen.getByText('Elisa')).toBeInTheDocument();
    expect(screen.getByText('aguardando resposta')).toBeInTheDocument();
  });

  it('ranking mostra posição, noites, % dos dias e marca o próprio usuário', async () => {
    openScreen();
    const regiao = await screen.findByRole('region', { name: 'Ranking de noites registradas' });
    expect(within(regiao).getByText('1º')).toBeInTheDocument();
    expect(within(regiao).getByText('6 noites · 86% dos dias')).toBeInTheDocument();
    expect(within(regiao).getByText('Ana (você)')).toBeInTheDocument();
    expect(within(regiao).getByText('3 noites · 43% dos dias')).toBeInTheDocument();
  });

  it('toggle de compartilhar salva o opt-in na conta', async () => {
    openScreen();
    fireEvent.click(await screen.findByLabelText('Compartilhar minhas noites registradas com amigos'));

    await waitFor(() => expect(calls('PUT', '/api/me').length).toBe(1));
    expect(JSON.parse(calls('PUT', '/api/me')[0][1].body)).toEqual({ shareWithFriends: true });
  });

  it('envia convite pelo e-mail digitado e confirma', async () => {
    openScreen();
    fireEvent.change(await screen.findByLabelText('E-mail do amigo'), { target: { value: 'fabio@exemplo.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar convite' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Se este e-mail tiver conta, o convite foi enviado.');
    expect(JSON.parse(calls('POST', '/friends/requests')[0][1].body)).toEqual({ email: 'fabio@exemplo.com' });
  });

  it('aceita convite recebido', async () => {
    openScreen();
    fireEvent.click((await screen.findAllByText('Aceitar'))[0]);

    await waitFor(() => expect(calls('POST', '/friends/requests/r1/accept').length).toBe(1));
  });

  it('recusa convite recebido', async () => {
    openScreen();
    fireEvent.click((await screen.findAllByText('Recusar'))[0]);

    await waitFor(() => expect(calls('POST', '/friends/requests/r1/decline').length).toBe(1));
  });

  it('cancela convite enviado', async () => {
    openScreen();
    fireEvent.click((await screen.findAllByText('Cancelar'))[0]);

    await waitFor(() => expect(calls('DELETE', '/friends/requests/s1').length).toBe(1));
  });

  it('remove amizade', async () => {
    openScreen();
    fireEvent.click((await screen.findAllByText('Remover'))[0]);

    await waitFor(() => expect(calls('DELETE', '/api/friends/f1').length).toBe(1));
  });

  it('troca o período do ranking para 30 dias', async () => {
    openScreen();
    fireEvent.click(await screen.findByRole('button', { name: '30 dias' }));

    await waitFor(() => expect(screen.getByText('21 noites · 70% dos dias')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '30 dias' })).toHaveAttribute('aria-pressed', 'true');
    expect(calls('GET', 'days=30').length).toBe(1);
  });

  it('resposta atrasada do período antigo não sobrescreve o escolhido por último (#266)', async () => {
    // A resposta dos 30 dias fica pendente até nós liberarmos, simulando a
    // chegada fora de ordem depois de o usuário já ter voltado para 7 dias.
    let liberar30: () => void = () => {};
    const ranking30Pendente = new Promise<Response>((resolve) => {
      liberar30 = () => resolve(jsonResponse(RANKING_30));
    });
    fetchMock.mockImplementation(async (url: any, options: any = {}) => {
      const path = String(url);
      const method = options.method ?? 'GET';
      if (path.includes('/api/me') && method === 'GET') return jsonResponse(ME);
      if (path.includes('/friends/requests')) return jsonResponse({ sent: [], received: [] });
      if (path.includes('/friends/ranking?days=30')) return ranking30Pendente;
      if (path.includes('/friends/ranking')) return jsonResponse(RANKING_7);
      if (path.includes('/api/friends')) return jsonResponse([]);
      return jsonResponse({});
    });

    openScreen();
    await screen.findByText('3 noites · 43% dos dias'); // ranking de 7 carregado

    fireEvent.click(screen.getByRole('button', { name: '30 dias' })); // dispara e fica pendente
    fireEvent.click(screen.getByRole('button', { name: '7 dias' })); // última escolha
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '7 dias' })).toHaveAttribute('aria-pressed', 'true'),
    );

    // A resposta antiga chega atrasada e precisa ser ignorada.
    await act(async () => {
      liberar30();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.queryByText('21 noites · 70% dos dias')).not.toBeInTheDocument();
    expect(screen.getByText('3 noites · 43% dos dias')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7 dias' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('erro da API aparece como alerta sem quebrar a tela', async () => {
    fetchMock.mockImplementation(async (url: any, options: any = {}) => {
      const path = String(url);
      const method = options.method ?? 'GET';
      if (path.includes('/friends/requests') && method === 'POST') {
        return jsonResponse({ detail: 'Erro interno' }, 500);
      }
      if (path.includes('/api/me')) return jsonResponse(ME);
      if (path.includes('/friends/requests')) return jsonResponse({ sent: [], received: [] });
      if (path.includes('/friends/ranking')) return jsonResponse({ days: 7, ranking: [] });
      if (path.includes('/api/friends')) return jsonResponse([]);
      return jsonResponse({});
    });
    openScreen();

    fireEvent.change(await screen.findByLabelText('E-mail do amigo'), { target: { value: 'fantasma@exemplo.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar convite' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Erro interno');
  });

  it('avisa que o convite não é amizade até o aceite', async () => {
    openScreen();
    expect(await screen.findByText(/Não confirmamos se o e-mail tem conta/)).toBeInTheDocument();
    expect(screen.getByText(/Seus horários e registros nunca aparecem no ranking/)).toBeInTheDocument();
  });
});
