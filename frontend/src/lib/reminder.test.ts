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
  static chamadas = [];
  static requestPermission = vi.fn();

  constructor(titulo, opcoes) {
    NotificationFake.chamadas.push({ titulo, ...opcoes });
  }
}

function jsonResponse(body) {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe('lembrete de dormir', () => {
  beforeEach(() => {
    localStorage.clear();
    NotificationFake.permission = 'granted';
    NotificationFake.chamadas = [];
    NotificationFake.requestPermission = vi.fn().mockResolvedValue('granted');
    window.Notification = NotificationFake;
  });

  afterEach(() => {
    cancelarLembrete();
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete window.Notification;
    delete window.navigator.serviceWorker;
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
    window.Notification = NotificationMovel;
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
    window.Notification = class {
      constructor() {
        throw new Error('sem suporte');
      }
    };

    agendarLembrete('23:00');
    await vi.advanceTimersByTimeAsync(61 * 1000); // não deve lançar

    expect(NotificationFake.chamadas).toHaveLength(0);
  });

  it('agenda na abertura do app quando a preferência está ativa', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 22, 0, 0));
    setLembreteAtivo(true);
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ targetMinutes: 480, bedtime: '23:00:00', wakeTime: '07:00:00' }));

    await expect(iniciarLembrete()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(NotificationFake.chamadas).toHaveLength(1);
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
    delete window.Notification;
    expect(suportaNotificacao()).toBe(false);
    expect(permissaoNotificacao()).toBe('unsupported');
  });
});
