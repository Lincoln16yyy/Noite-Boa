import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard';
import { renderWithAuth } from '../test/test-utils';

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status }) as any;
}

const summary7 = {
  days: 7,
  averageHours: 7.5,
  consistencyMinutes: 12.4,
  sleepDebtMinutes: 210,
  daily: [{ date: '2026-10-07', hoursSlept: 8, bedtime: '23:10' }],
};

const summary30 = { ...summary7, days: 30, averageHours: 6.25 };

const mockUser = { id: 'u1', email: 'a@example.com', displayName: 'Teste', timezone: 'America/Sao_Paulo', shareWithFriends: true };

function openScreen() {
  renderWithAuth(<Dashboard />, { user: mockUser, route: '/dashboard' });
}

describe('Dashboard', () => {
  let fetchMock: any;
  let currentSummary: any;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    currentSummary = summary7;
    fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes('/me')) return jsonResponse(mockUser);
      if (path.includes('/goal')) return jsonResponse({ targetMinutes: 480, bedtime: null, wakeTime: null });
      if (path.includes('days=30')) return jsonResponse(summary30);
      if (path.includes('days=7')) return jsonResponse(currentSummary);
      return jsonResponse({});
    });
  });

  it('mostra estado vazio com atalho para registrar', async () => {
    currentSummary = { ...summary7, daily: [] };
    openScreen();

    expect(await screen.findByText('Sem dados nos últimos 7 dias.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Registrar uma noite/ })).toHaveAttribute('href', '/registrar');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('mostra cartões e gráfico com dados da API', async () => {
    openScreen();

    expect(await screen.findByText('7h30')).toBeInTheDocument(); // média 7.5 h
    expect(screen.getByText('±12 min')).toBeInTheDocument(); // consistência
    expect(screen.getByText('3h30')).toBeInTheDocument(); // dívida (210 min)
    expect(await screen.findByRole('img', { name: /Gráfico de barras/ })).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([url]: any) => String(url).includes('/stats/summary?days=7')),
    ).toBe(true);
  });

  it('alterna para 30 dias e recarrega', async () => {
    openScreen();
    await screen.findByText('7h30');

    fireEvent.click(screen.getByRole('button', { name: '30 dias' }));

    expect(await screen.findByText('6h15')).toBeInTheDocument(); // média 6.25 h
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]: any) => String(url).includes('days=30'))).toBe(true),
    );
    expect(screen.getByRole('button', { name: '30 dias' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('cartão de média mostra meta, quanto falta por noite e a linha da meta', async () => {
    openScreen();
    // média 7h30 com meta 8h → faltam 30 min
    expect(await screen.findByText('Meta de 8h · faltam 30 min por noite')).toBeInTheDocument();
    // rótulo da meta FORA da área das barras
    expect(screen.getByText('- - meta de 8h')).toBeInTheDocument();
  });

  it('mostra "meta atingida" quando a média alcança a meta', async () => {
    currentSummary = { ...summary7, averageHours: 8.5 };
    openScreen();
    expect(await screen.findByText('Meta de 8h · meta atingida')).toBeInTheDocument();
  });

  it('dica: dívida de 210 min → 30 min mais cedo por noite (ceil(210/7))', async () => {
    openScreen();
    expect(
      await screen.findByText('Dormir 30 minutos mais cedo nas próximas 7 noites zera sua dívida de 3h30.'),
    ).toBeInTheDocument();
  });

  it('dívida 0 mostra a dica de "dentro da meta" e a barra em tom positivo', async () => {
    currentSummary = { ...summary7, sleepDebtMinutes: 0 };
    openScreen();
    expect(await screen.findByText('Você está dentro da meta. Mantenha o ritmo!')).toBeInTheDocument();
  });

  it('em 30 dias as letras dos dias dão lugar às pontas início/hoje', async () => {
    openScreen();
    await screen.findByText('7h30');
    fireEvent.click(screen.getByRole('button', { name: '30 dias' }));
    expect(await screen.findByText('6h15')).toBeInTheDocument();
    expect(screen.getByText('início')).toBeInTheDocument();
    expect(screen.getByText('hoje')).toBeInTheDocument();
  });

  it('mostra erro com opção de tentar novamente', async () => {
    fetchMock.mockImplementation(async (url: any) => {
      if (String(url).includes('/goal')) return jsonResponse({ targetMinutes: 480 });
      return jsonResponse({ detail: 'algo quebrou' }, 500);
    });

    openScreen();

    expect(await screen.findByRole('alert')).toHaveTextContent('algo quebrou');
    fetchMock.mockImplementation(async (url: any) => {
      if (String(url).includes('/goal')) return jsonResponse({ targetMinutes: 480 });
      return jsonResponse(summary7);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('7h30')).toBeInTheDocument();
  });
});
