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
    let liberar30: ((valor: Response) => void) | undefined;
    const ranking30Pendente = new Promise<Response>((resolve) => {
      liberar30 = resolve;
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
      liberar30?.(jsonResponse(RANKING_30));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.queryByText('21 noites · 70% dos dias')).not.toBeInTheDocument();
    expect(screen.getByText('3 noites · 43% dos dias')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7 dias' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('carregar() em andamento não sobrescreve o período escolhido depois (#266)', async () => {
    // A 1ª carga do ranking (7 dias) resolve normalmente; a 2ª — disparada por um
    // carregar() depois de uma ação — fica pendente até nós liberarmos.
    let liberar7: ((valor: Response) => void) | undefined;
    const ranking7Pendente = new Promise<Response>((resolve) => {
      liberar7 = resolve;
    });
    let chamadasRanking7 = 0;
    fetchMock.mockImplementation(async (url: any, options: any = {}) => {
      const path = String(url);
      const method = options.method ?? 'GET';
      if (path.includes('/api/me') && method === 'PUT') return jsonResponse({ ...ME, ...JSON.parse(options.body) });
      if (path.includes('/api/me')) return jsonResponse(ME);
      if (path.includes('/friends/requests')) return jsonResponse(CONVITES);
      if (path.includes('/friends/ranking?days=30')) return jsonResponse(RANKING_30);
      if (path.includes('/friends/ranking?days=7')) {
        chamadasRanking7 += 1;
        return chamadasRanking7 === 1 ? jsonResponse(RANKING_7) : ranking7Pendente;
      }
      if (path.includes('/api/friends')) return jsonResponse(AMIGOS);
      return jsonResponse({});
    });

    openScreen();
    await screen.findByText('3 noites · 43% dos dias');

    // Aceitar o convite dispara executar(...) -> carregar(), cujo ranking fica pendente
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar' }));
    await waitFor(() => expect(chamadasRanking7).toBe(2));

    // Nesse meio-tempo o usuário escolhe 30 dias
    fireEvent.click(screen.getByRole('button', { name: '30 dias' }));
    expect(await screen.findByText('21 noites · 70% dos dias')).toBeInTheDocument();

    // A resposta atrasada do carregar() não pode trazer o ranking de 7 de volta
    await act(async () => {
      liberar7?.(jsonResponse(RANKING_7));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.queryByText('3 noites · 43% dos dias')).not.toBeInTheDocument();
    expect(screen.getByText('21 noites · 70% dos dias')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30 dias' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('refresh iniciado antes da troca de período busca a seleção mais recente (#266)', async () => {
    // O aceite do convite demora; quando ele conclui, o carregar() dispara já
    // depois de o usuário ter escolhido 30 dias. Ele precisa buscar 30 — não o
    // `dias` capturado no closure do clique (era 7).
    let liberarAceite: ((valor: Response) => void) | undefined;
    const aceitePendente = new Promise<Response>((resolve) => {
      liberarAceite = resolve;
    });
    fetchMock.mockImplementation(async (url: any, options: any = {}) => {
      const path = String(url);
      const method = options.method ?? 'GET';
      if (path.includes('/api/me')) return jsonResponse(ME);
      if (path.includes('/friends/requests') && method === 'POST' && path.includes('/accept')) return aceitePendente;
      if (path.includes('/friends/requests')) return jsonResponse(CONVITES);
      if (path.includes('/friends/ranking?days=30')) return jsonResponse(RANKING_30);
      if (path.includes('/friends/ranking')) return jsonResponse(RANKING_7);
      if (path.includes('/api/friends')) return jsonResponse(AMIGOS);
      return jsonResponse({});
    });

    openScreen();
    await screen.findByText('3 noites · 43% dos dias');

    fireEvent.click(screen.getByRole('button', { name: 'Aceitar' })); // aceite fica pendente
    fireEvent.click(screen.getByRole('button', { name: '30 dias' })); // última seleção
    expect(await screen.findByText('21 noites · 70% dos dias')).toBeInTheDocument();

    // O aceite conclui e o carregar() finalmente dispara
    await act(async () => {
      liberarAceite?.(jsonResponse({ id: 'r1', status: 'accepted' }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // O refresh foi de 30 dias (2ª busca por 30), não de 7 (que segue com 1 busca)
    await waitFor(() => expect(calls('GET', 'days=30').length).toBe(2));
    expect(calls('GET', 'days=7').length).toBe(1);
    expect(screen.getByText('21 noites · 70% dos dias')).toBeInTheDocument();
    expect(screen.queryByText('3 noites · 43% dos dias')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30 dias' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('limpa o alerta depois de "Tentar novamente" bem-sucedido (#267)', async () => {
    // Primeira carga falha; o usuário tenta de novo e a API volta.
    let apiForaDoAr = true;
    fetchMock.mockImplementation(async (url: any) => {
      const path = String(url);
      if (apiForaDoAr && path.includes('/api/me')) return jsonResponse({ detail: 'API fora do ar' }, 500);
      if (path.includes('/api/me')) return jsonResponse(ME);
      if (path.includes('/friends/requests')) return jsonResponse(CONVITES);
      if (path.includes('/friends/ranking')) return jsonResponse(RANKING_7);
      if (path.includes('/api/friends')) return jsonResponse(AMIGOS);
      return jsonResponse({});
    });

    openScreen();
    expect(await screen.findByRole('alert')).toHaveTextContent('API fora do ar');

    apiForaDoAr = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    // Os dados voltam para a tela e o alerta antigo não pode continuar aparecendo.
    expect(await screen.findByText('3 noites · 43% dos dias')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('se o próprio "Tentar novamente" falhar, o alerta e o botão continuam (#267)', async () => {
    // A API segue fora do ar: a carga inicial falha e o retry falha de novo.
    fetchMock.mockImplementation(async () => jsonResponse({ detail: 'API fora do ar' }, 500));

    openScreen();
    expect(await screen.findByRole('alert')).toHaveTextContent('API fora do ar');

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    // O alerta não pode sumir: o usuário precisa poder tentar de novo.
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('API fora do ar'));
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
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
    // Erro de ação não ganha "Tentar novamente": esse botão recarregaria os dados,
    // não repetiria o convite — e o alerta fica visível até a ação ser refeita (#267).
    const alertaAcao = screen.getByRole('alert');
    expect(alertaAcao).toHaveTextContent('Não foi possível completar a ação.');
    expect(within(alertaAcao).queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument();
  });

  it('avisa que o convite não é amizade até o aceite', async () => {
    openScreen();
    expect(await screen.findByText(/Não confirmamos se o e-mail tem conta/)).toBeInTheDocument();
    expect(screen.getByText(/Seus horários e registros nunca aparecem no ranking/)).toBeInTheDocument();
  });
});
