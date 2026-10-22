import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  agendarLembrete,
  cancelarLembrete,
  iniciarLembrete,
  lembreteAtivo,
  msAte,
  permissaoNotificacao,
  setLembreteAtivo,
  suportaNotificacao,
} from './reminder';

class NotificationFake {
  static permission = 'granted';
  static chamadas: Array<{ titulo: string; [key: string]: unknown }> = [];
  static requestPermission = vi.fn();

  constructor(titulo: string, opcoes?: NotificationOptions) {
    NotificationFake.chamadas.push({ titulo, ...opcoes });
  }
}

/** Instala um duplo de teste em window.Notification (sem exigir o tipo real). */
function instalarNotification(fake: unknown): void {
  Object.defineProperty(window, 'Notification', { value: fake, configurable: true, writable: true });
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

/** Duplo de Notification cujo construtor falha — simula browser sem suporte. */
function FailingNotification(): never {
  throw new Error('sem suporte');
}

describe('lembrete de dormir', () => {
  beforeEach(() => {
    localStorage.clear();
    NotificationFake.permission = 'granted';
    NotificationFake.chamadas = [];
    NotificationFake.requestPermission = vi.fn().mockResolvedValue('granted');
    instalarNotification(NotificationFake);
  });

  afterEach(() => {
    cancelarLembrete();
    vi.useRealTimers();
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, 'Notification');
    Reflect.deleteProperty(window.navigator, 'serviceWorker');
  });

  it('guarda a preferência apenas neste dispositivo', () => {
    expect(lembreteAtivo()).toBe(false);
    setLembreteAtivo(true);
    expect(lembreteAtivo()).toBe(true);
    expect(localStorage.getItem('noiteboa.lembrete')).toBe('1');
    setLembreteAtivo(false);
    expect(lembreteAtivo()).toBe(false);
    expect(localStorage.getItem('noiteboa.lembrete')).toBeNull();
  });

  it('calcula o tempo até o próximo horário', () => {
    const agora = new Date(2026, 0, 5, 22, 0, 0); // 05/01/2026 22:00
    expect(msAte('23:00', agora)).toBe(60 * 60 * 1000);
    expect(msAte('22:30', agora)).toBe(30 * 60 * 1000);
    expect(msAte('21:00', agora)).toBe(23 * 60 * 60 * 1000); // já passou: amanhã
    expect(msAte('banana', agora)).toBeNull();
  });

  it('interpreta HH:MM no fuso do perfil, não no do aparelho (#278)', () => {
    // 05/01/2026 01:00 UTC = 22:00 em São Paulo e 10:00 em Tóquio.
    const agora = new Date(Date.UTC(2026, 0, 5, 1, 0, 0));
    expect(msAte('23:00', agora, 'America/Sao_Paulo')).toBe(60 * 60 * 1000);
    expect(msAte('23:00', agora, 'Asia/Tokyo')).toBe(13 * 60 * 60 * 1000);
    // 09:00 em Tóquio já passou: cai para o dia seguinte.
    expect(msAte('09:00', agora, 'Asia/Tokyo')).toBe(23 * 60 * 60 * 1000);
  });

  it('agenda no fuso do perfil (#278)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 5, 1, 0, 0))); // 22:00 em SP

    expect(agendarLembrete('23:00', 'Asia/Tokyo')).toBe(true);

    await vi.advanceTimersByTimeAsync(12 * 60 * 60 * 1000);
    expect(NotificationFake.chamadas).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 1000);
    expect(NotificationFake.chamadas).toHaveLength(1);
  });

  it('dispara no horário e rearma para o dia seguinte', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 22, 59, 0));

    expect(agendarLembrete('23:00')).toBe(true);
    await vi.advanceTimersByTimeAsync(61 * 1000);

    expect(NotificationFake.chamadas).toHaveLength(1);
    expect(NotificationFake.chamadas[0].titulo).toContain('Noite Boa');
    expect(NotificationFake.chamadas[0].body).toContain('23:00');

    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    expect(NotificationFake.chamadas).toHaveLength(2);
  });

  it('não agenda horário inválido', () => {
    vi.useFakeTimers();
    expect(agendarLembrete('25h')).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('usa o service worker quando o construtor de Notification lança (Chrome/Android)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 22, 59, 30));
    class NotificationMovel {
      static permission = 'granted';
      constructor() {
        throw new TypeError('não suportado fora de um service worker');
      }
    }
    instalarNotification(NotificationMovel);
    const showNotification = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: vi.fn().mockResolvedValue({ showNotification }) },
    });

    agendarLembrete('23:00');
    await vi.advanceTimersByTimeAsync(61 * 1000);

    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification.mock.calls[0][0]).toContain('Noite Boa');
    expect(showNotification.mock.calls[0][1].body).toContain('23:00');
  });

  it('não quebra quando o construtor falha e não há service worker', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 22, 59, 30));
    instalarNotification(FailingNotification);

    agendarLembrete('23:00');
    await vi.advanceTimersByTimeAsync(61 * 1000); // não deve lançar

    expect(NotificationFake.chamadas).toHaveLength(0);
  });

  it('agenda na abertura do app quando a preferência está ativa', async () => {
    vi.useFakeTimers();
    // 01:00 UTC = 22:00 em São Paulo: o alvo de 23:00 do perfil é daqui a 1 h,
    // independente do fuso do aparelho que roda o teste (#278).
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 5, 1, 0, 0)));
    setLembreteAtivo(true);
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ targetMinutes: 480, bedtime: '23:00:00', wakeTime: '07:00:00' }));

    await expect(iniciarLembrete('America/Sao_Paulo')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(NotificationFake.chamadas).toHaveLength(1);
  });

  it('na ida do horário de verão usa o fim do buraco (#278)', () => {
    // Lisboa, 29/03/2026: 01:00 → 02:00; 01:30 não existe. O primeiro
    // instante com relógio de parede depois de 01:30 é 02:00 (01:00Z).
    const agora = new Date('2026-03-29T00:00:00Z');
    expect(msAte('01:30', agora, 'Europe/Lisbon')).toBe(60 * 60 * 1000);
  });

  it('na volta do horário de verão usa a primeira ocorrência ainda à frente (#278)', () => {
    // Lisboa, 25/10/2026: 02:00 → 01:00; 01:30 ocorre às 00:30Z (WEST) e
    // 01:30Z (WET). Às 00:00Z (01:00 WEST) o alvo é a primeira: 30 min.
    const agora = new Date('2026-10-25T00:00:00Z');
    expect(msAte('01:30', agora, 'Europe/Lisbon')).toBe(30 * 60 * 1000);
  });

  it('na abertura usa o fuso do perfil mesmo com o aparelho em outro fuso (#278)', async () => {
    vi.useFakeTimers();
    // 01:00 UTC = 10:00 em Tóquio; 23:00 no perfil de Tóquio é daqui a 13 h.
    // Em UTC seriam 22 h e em São Paulo 1 h — qualquer um dos dois falha aqui.
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 5, 1, 0, 0)));
    setLembreteAtivo(true);
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ targetMinutes: 480, bedtime: '23:00:00', wakeTime: '07:00:00' }));

    await expect(iniciarLembrete('Asia/Tokyo')).resolves.toBe(true);
    // O fuso vem do contexto (/me), não de uma segunda consulta na abertura.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(12 * 60 * 60 * 1000);
    expect(NotificationFake.chamadas).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 1000);
    expect(NotificationFake.chamadas).toHaveLength(1);
  });

  it('resposta velha do /goal não desfaz um agendamento mais novo (#278)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T22:00:00Z'));
    setLembreteAtivo(true);
    let responderGoal: ((valor: Response) => void) | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          responderGoal = resolve;
        }),
    );

    const iniciar = iniciarLembrete('UTC');
    // A pessoa salva 22:30 enquanto o /goal da abertura ainda está em voo.
    agendarLembrete('22:30', 'UTC');
    responderGoal?.(jsonResponse({ bedtime: '23:00:00' }));

    await expect(iniciar).resolves.toBe(false);
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    expect(NotificationFake.chamadas).toHaveLength(1);
    expect(NotificationFake.chamadas[0].body).toContain('22:30');
  });

  it('não arma se o lembrete for desligado durante a abertura (#278)', async () => {
    vi.useFakeTimers();
    setLembreteAtivo(true);
    let responderGoal: ((valor: Response) => void) | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          responderGoal = resolve;
        }),
    );

    const iniciar = iniciarLembrete('UTC');
    setLembreteAtivo(false);
    cancelarLembrete();
    responderGoal?.(jsonResponse({ bedtime: '23:00:00' }));

    await expect(iniciar).resolves.toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('não busca a meta sem a preferência ativa', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(iniciarLembrete()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('não agenda sem permissão de notificação', async () => {
    NotificationFake.permission = 'denied';
    setLembreteAtivo(true);
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(iniciarLembrete()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('não agenda sem horário de dormir na meta', async () => {
    setLembreteAtivo(true);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ targetMinutes: 480, bedtime: null }));
    await expect(iniciarLembrete()).resolves.toBe(false);
  });

  it('informa quando o navegador não suporta notificação', () => {
    Reflect.deleteProperty(window, 'Notification');
    expect(suportaNotificacao()).toBe(false);
    expect(permissaoNotificacao()).toBe('unsupported');
  });
});
