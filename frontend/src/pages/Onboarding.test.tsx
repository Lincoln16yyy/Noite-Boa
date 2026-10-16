import { fireEvent, renderWithAuth, screen, waitFor } from '../test/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import Onboarding from './Onboarding';
import type { User } from '../api/types';

const usuario: User = {
  id: 'u1',
  email: 'a@example.com',
  displayName: 'Ana',
  timezone: 'America/Sao_Paulo',
  shareWithFriends: true,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function abrir() {
  return renderWithAuth(
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      {/* Dublê da Hoje: provar que o fluxo termina lá (critério de aceite). */}
      <Route path="/hoje" element={<p>chegou na Hoje</p>} />
    </Routes>,
    { user: usuario, route: '/onboarding' },
  );
}

describe('primeiro uso em 3 passos', () => {
  let fetchMock: MockInstance<typeof fetch>;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options = {}) => {
      // O /goal do PUT devolve o corpo enviado, como a API real faz.
      return jsonResponse(JSON.parse(String(options.body ?? '{}')));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function puts() {
    return fetchMock.mock.calls.filter(([, options]) => (options?.method ?? 'GET') === 'PUT');
  }

  it('percorre os 3 passos, salva a meta e termina na Hoje', async () => {
    abrir();

    // Passo 1: meta de horas (4 a 12), com 8h já visível.
    expect(screen.getByRole('heading', { level: 1, name: /quanto você quer dormir/i })).toBeInTheDocument();
    const horas = screen.getByRole('slider', { name: /meta de horas por noite/i });
    fireEvent.change(horas, { target: { value: '7' } });

    fireEvent.click(screen.getByRole('button', { name: /^avançar$/i }));
    await screen.findByRole('heading', { level: 1, name: /qual é o seu horário/i });
    expect(puts()).toHaveLength(1);
    expect(JSON.parse(String(puts()[0][1]?.body))).toEqual({ targetMinutes: 420 });

    // Passo 2: horários (opcionais).
    fireEvent.change(screen.getByLabelText(/^hora de dormir$/i), { target: { value: '23:30' } });
    fireEvent.change(screen.getByLabelText(/^hora de acordar$/i), { target: { value: '06:45' } });
    fireEvent.click(screen.getByRole('button', { name: /^avançar$/i }));

    // Passo 3: só explica, não é alarme.
    await screen.findByRole('heading', { level: 1, name: /sobre lembretes/i });
    expect(screen.getByText(/não é um alarme/i)).toBeInTheDocument();
    expect(puts()).toHaveLength(2);
    expect(JSON.parse(String(puts()[1][1]?.body))).toEqual({
      targetMinutes: 420,
      bedtime: '23:30',
      wakeTime: '06:45',
    });

    fireEvent.click(screen.getByRole('button', { name: /começar a registrar/i }));
    await screen.findByText('chegou na Hoje');
    expect(localStorage.getItem('noiteboa.onboarding-concluido')).toBe('1');
  });

  it('pular no passo 1 não salva nada e leva à Hoje', async () => {
    abrir();
    fireEvent.click(screen.getByRole('button', { name: /agora não/i }));

    await screen.findByText('chegou na Hoje');
    expect(puts()).toHaveLength(0);
    expect(localStorage.getItem('noiteboa.onboarding-concluido')).toBe('1');
  });

  it('pular no passo 2 salva só as horas e segue para o 3', async () => {
    abrir();
    fireEvent.click(screen.getByRole('button', { name: /^avançar$/i }));
    await screen.findByRole('heading', { level: 1, name: /qual é o seu horário/i });

    fireEvent.change(screen.getByLabelText(/^hora de dormir$/i), { target: { value: '23:00' } });
    fireEvent.click(screen.getByRole('button', { name: /^pular$/i }));

    await screen.findByRole('heading', { level: 1, name: /sobre lembretes/i });
    expect(puts()).toHaveLength(1); // só a meta do passo 1
    expect(JSON.parse(String(puts()[0][1]?.body))).toEqual({ targetMinutes: 480 });
  });

  it('horário em branco não vai para a API', async () => {
    abrir();
    fireEvent.click(screen.getByRole('button', { name: /^avançar$/i }));
    await screen.findByRole('heading', { level: 1, name: /qual é o seu horário/i });

    fireEvent.click(screen.getByRole('button', { name: /^avançar$/i }));
    await screen.findByRole('heading', { level: 1, name: /sobre lembretes/i });

    expect(JSON.parse(String(puts()[1][1]?.body))).toEqual({ targetMinutes: 480 });
  });

  it('erro ao salvar mostra o alerta e não avança de passo', async () => {
    fetchMock.mockImplementation(
      async () => jsonResponse({ title: 'Dados inválidos' }, 400),
    );
    abrir();

    fireEvent.click(screen.getByRole('button', { name: /^avançar$/i }));

    await screen.findByRole('alert');
    expect(screen.getByRole('heading', { level: 1, name: /quanto você quer dormir/i })).toBeInTheDocument();
    expect(localStorage.getItem('noiteboa.onboarding-concluido')).toBeNull();
  });

  it('move o foco para o título a cada passo (teclado e leitor de tela)', async () => {
    abrir();
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus());

    fireEvent.click(screen.getByRole('button', { name: /^avançar$/i }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: /qual é o seu horário/i })).toHaveFocus());

    fireEvent.click(screen.getByRole('button', { name: /^pular$/i }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: /sobre lembretes/i })).toHaveFocus());
  });

  it('o campo de horas é operável pelo teclado (slider com setas)', () => {
    abrir();
    const horas = screen.getByRole('slider', { name: /meta de horas por noite/i }) as HTMLInputElement;
    expect(horas.min).toBe('4');
    expect(horas.max).toBe('12');
    fireEvent.change(horas, { target: { value: '12' } });
    expect(screen.getByText('12h')).toBeInTheDocument();
  });
});
