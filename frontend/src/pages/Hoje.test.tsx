import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import Hoje from './Hoje';
import { renderWithAuth } from '../test/test-utils';

const mockUser = { id: 'u1', email: 'a@example.com', displayName: 'Teste', timezone: 'America/Sao_Paulo', shareWithFriends: true };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

// Último registro: 22:00Z → 05:36Z = 7h36 (456 min) = 95% da meta de 8h.
const ultimoLog = {
  id: 'log-1',
  sleepStart: '2026-10-07T22:00:00Z',
  sleepEnd: '2026-10-08T05:36:00Z',
  quality: 4,
  notes: null,
};

const resumo = {
  days: 7,
  averageHours: 7.35,
  consistencyMinutes: 38,
  sleepDebtMinutes: 150,
  daily: [
    { date: '2026-10-07', hoursSlept: 8.4, bedtime: '22:45' },
    { date: '2026-10-06', hoursSlept: 5.9, bedtime: '00:20' },
  ],
};

function abrirHoje(opcoes: { logs?: unknown[]; resumo?: unknown; meta?: unknown; falhar?: boolean } = {}) {
  const { logs = [ultimoLog], resumo: resumoMock = resumo, meta = { targetMinutes: 480, bedtime: '23:00:00' }, falhar = false } = opcoes;

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const caminho = String(url);
    if (falhar) throw new Error('falha de rede');
    if (caminho.includes('/me')) return jsonResponse(mockUser);
    if (caminho.includes('/sleep-logs')) return jsonResponse({ content: logs, totalElements: logs.length, totalPages: 1 });
    if (caminho.includes('/stats/summary')) return jsonResponse(resumoMock);
    if (caminho.includes('/goal')) return jsonResponse(meta);
    return jsonResponse({});
  });

  return renderWithAuth(
    <Routes>
      <Route path="/hoje" element={<Hoje />} />
      <Route path="/registrar" element={<h1>Tela de registro</h1>} />
    </Routes>,
    { user: mockUser, route: '/hoje' },
  );
}

describe('tela Hoje (issue #210)', () => {
  beforeEach(() => {
    localStorage.clear();
    // Relógio fixo (só o Date — timers seguem reais para o waitFor do RTL):
    // 22:48Z = 19:48 em São Paulo → faltam 3h12 para as 23:00.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-13T22:48:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('mostra o anel da última noite com duração, porcentagem e horários no fuso do perfil', async () => {
    abrirHoje();

    expect(await screen.findByText('Última noite')).toBeInTheDocument();
    // 7h36 = 456 min; meta 480 → 95%. O número de destaque conta do zero até
    // o final (issue #216), então o valor final chega depois da montagem.
    expect(await screen.findByText('7h36')).toBeInTheDocument();
    expect(screen.getByText('95% da meta de 8h')).toBeInTheDocument();
    // 22:00Z = 19:00 em São Paulo; 05:36Z = 02:36
    expect(screen.getByText('Dormiu 19:00 · Acordou 02:36')).toBeInTheDocument();
    // O nome acessível do anel usa o valor real desde o primeiro render — só a
    // apresentação anima, o leitor de tela nunca ouve a contagem.
    expect(screen.getByRole('img', { name: /Última noite: 7h36, 95% da meta/ })).toBeInTheDocument();
  });

  it('mostra a contagem para a hora de dormir e a meta', async () => {
    abrirHoje();
    expect(await screen.findByText('em 3h12')).toBeInTheDocument();
    expect(screen.getByText('Meta')).toBeInTheDocument();
    expect(screen.getByText('23:00')).toBeInTheDocument();
  });

  it('esconde o bloco de hora de dormir quando a meta não tem horário', async () => {
    abrirHoje({ meta: { targetMinutes: 480 } });
    await screen.findByText('Última noite');
    expect(screen.queryByText('Hora de dormir')).not.toBeInTheDocument();
  });

  it('mostra a semana em barras com as iniciais dos dias', async () => {
    abrirHoje();
    await screen.findByText('Esta semana');
    // 7 colunas com letra de dia (a série termina hoje, no fuso do perfil).
    expect(screen.getAllByText(/^[DSTQ]$/)).toHaveLength(7);
  });

  it('mostra a comparação com a semana anterior quando a API manda o dado', async () => {
    abrirHoje({ resumo: { ...resumo, previousAverageHours: 7.1 } });
    expect(await screen.findByText('+15 min vs. semana passada')).toBeInTheDocument();
  });

  it('esconde a comparação quando a API não manda o dado (issue #206)', async () => {
    abrirHoje();
    await screen.findByText('Esta semana');
    expect(screen.queryByText(/vs\. semana passada/)).not.toBeInTheDocument();
  });

  it('estado vazio convida a registrar quando não há noites', async () => {
    abrirHoje({ logs: [], resumo: { days: 7, averageHours: 0, daily: [] } });

    expect(await screen.findByText('Nenhuma noite registrada ainda.')).toBeInTheDocument();
    // Estado vazio: sem anel, sem semana para mostrar.
    expect(screen.queryByText(/da meta de 8h/)).not.toBeInTheDocument();
    expect(screen.queryByText('Esta semana')).not.toBeInTheDocument();
  });

  it('estado de erro com opção de tentar novamente', async () => {
    abrirHoje({ falhar: true });

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(/Não foi possível carregar sua noite/);

    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const caminho = String(url);
      if (caminho.includes('/sleep-logs')) return jsonResponse({ content: [ultimoLog] });
      if (caminho.includes('/stats/summary')) return jsonResponse(resumo);
      if (caminho.includes('/goal')) return jsonResponse({ targetMinutes: 480, bedtime: '23:00:00' });
      return jsonResponse({});
    });

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('95% da meta de 8h')).toBeInTheDocument();
  });

  it('corta a porcentagem em 100 quando dormiu mais que a meta', async () => {
    abrirHoje({
      logs: [{ ...ultimoLog, sleepStart: '2026-10-07T22:00:00Z', sleepEnd: '2026-10-08T08:30:00Z' }], // 10h30
    });
    expect(await screen.findByText('100% da meta de 8h')).toBeInTheDocument();
  });

  it('botão "Registrar noite" leva para /registrar', async () => {
    abrirHoje();
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar noite' }));
    expect(await screen.findByRole('heading', { name: 'Tela de registro' })).toBeInTheDocument();
  });

  it('usa o fuso do perfil para os horários, não o do aparelho', async () => {
    // Em Tóquio (UTC+9): 22:00Z = 07:00, 05:36Z = 14:36. O user vem do /me.
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const caminho = String(url);
      if (caminho.includes('/me')) return jsonResponse({ ...mockUser, timezone: 'Asia/Tokyo' });
      if (caminho.includes('/sleep-logs')) return jsonResponse({ content: [ultimoLog] });
      if (caminho.includes('/stats/summary')) return jsonResponse(resumo);
      if (caminho.includes('/goal')) return jsonResponse({ targetMinutes: 480, bedtime: '23:00:00' });
      return jsonResponse({});
    });
    renderWithAuth(
      <Routes>
        <Route path="/hoje" element={<Hoje />} />
      </Routes>,
      { route: '/hoje' },
    );
    expect(await screen.findByText('Dormiu 07:00 · Acordou 14:36')).toBeInTheDocument();
  });
});
