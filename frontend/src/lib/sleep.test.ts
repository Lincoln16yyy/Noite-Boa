import { describe, expect, it } from 'vitest';
import {
  formatarDuracaoCurta,
  formatarDuracaoLonga,
  formatDuration,
  minutosEntre,
  porcentagemDaMeta,
  rotuloDiaRelativo,
  smartDefaults,
  toApiPayload,
  validateSleepForm,
} from './sleep';

describe('smartDefaults', () => {
  it('usa ontem 23:00 e hoje 07:00 durante o dia', () => {
    const now = new Date(2026, 9, 8, 15, 30); // 08/10/2026 15:30 local
    expect(smartDefaults(now)).toEqual({
      sleepStart: '2026-10-07T23:00',
      sleepEnd: '2026-10-08T07:00',
    });
  });

  it('usa "agora" como fim quando ainda é de madrugada', () => {
    const now = new Date(2026, 9, 8, 3, 15);
    expect(smartDefaults(now)).toEqual({
      sleepStart: '2026-10-07T23:00',
      sleepEnd: '2026-10-08T03:15',
    });
  });

  it('mantém a ordem das datas também logo após a meia-noite', () => {
    const now = new Date(2026, 9, 8, 0, 5);
    const { sleepStart, sleepEnd } = smartDefaults(now);
    expect(new Date(sleepEnd).getTime()).toBeGreaterThan(new Date(sleepStart).getTime());
  });
});

describe('validateSleepForm', () => {
  const valid = {
    sleepStart: '2026-10-07T23:00',
    sleepEnd: '2026-10-08T07:00',
    quality: 4,
    notes: 'dormi bem',
  };

  it('aceita um registro válido', () => {
    expect(validateSleepForm(valid)).toBe('');
  });

  it('exige os horários', () => {
    expect(validateSleepForm({ ...valid, sleepStart: '' })).toMatch(/horários/);
    expect(validateSleepForm({ ...valid, sleepEnd: '' })).toMatch(/horários/);
  });

  it('exige acordar depois de dormir', () => {
    expect(validateSleepForm({ ...valid, sleepEnd: '2026-10-07T22:00' })).toMatch(/depois de dormir/);
    expect(validateSleepForm({ ...valid, sleepEnd: valid.sleepStart })).toMatch(/depois de dormir/);
  });

  it('limita a duração em 24 horas', () => {
    expect(validateSleepForm({ ...valid, sleepEnd: '2026-10-08T23:30' })).toMatch(/24 horas/);
  });

  it('exige qualidade entre 1 e 5', () => {
    expect(validateSleepForm({ ...valid, quality: 0 })).toMatch(/1 a 5/);
    expect(validateSleepForm({ ...valid, quality: 6 })).toMatch(/1 a 5/);
  });

  it('limita a observação a 2000 caracteres', () => {
    expect(validateSleepForm({ ...valid, notes: 'x'.repeat(2001) })).toMatch(/2000/);
  });
});

describe('toApiPayload', () => {
  it('converte os horários locais para ISO com fuso', () => {
    const payload = toApiPayload({
      sleepStart: '2026-10-07T23:00',
      sleepEnd: '2026-10-08T07:00',
      quality: '4',
      notes: '',
    });
    expect(payload.sleepStart).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(payload.quality).toBe(4);
    expect(payload.notes).toBeNull();
    expect(new Date(payload.sleepEnd).getTime()).toBeGreaterThan(new Date(payload.sleepStart).getTime());
  });
});

describe('formatDuration', () => {
  it('formata horas e minutos', () => {
    expect(formatDuration('2026-10-07T23:00:00Z', '2026-10-08T07:00:00Z')).toBe('8h');
    expect(formatDuration('2026-10-07T23:00:00Z', '2026-10-08T06:30:00Z')).toBe('7h30m');
  });
});

describe('fuso do perfil (issue #102)', () => {
  const agora = new Date('2026-01-10T02:00:00Z'); // SP: 09/01 23:00 · Tokyo: 10/01 11:00

  it('smartDefaults segue a virada de dia do fuso do perfil', () => {
    // São Paulo às 23h: "hoje 07:00" do perfil (dia 09), ontem 23:00 vira 08
    expect(smartDefaults(agora, 'America/Sao_Paulo')).toEqual({
      sleepStart: '2026-01-08T23:00',
      sleepEnd: '2026-01-09T07:00',
    });
    // Tóquio às 11h: dia 10 de Tóquio — outro resultado para o MESMO instante
    expect(smartDefaults(agora, 'Asia/Tokyo')).toEqual({
      sleepStart: '2026-01-09T23:00',
      sleepEnd: '2026-01-10T07:00',
    });
  });

  it('smartDefaults de madrugada vira "agora" no fuso do perfil', () => {
    const madrugada = new Date('2026-01-10T06:00:00Z'); // SP: 03:00
    expect(smartDefaults(madrugada, 'America/Sao_Paulo')).toEqual({
      sleepStart: '2026-01-09T23:00',
      sleepEnd: '2026-01-10T03:00',
    });
  });

  it('toApiPayload interpreta os horários digitados no fuso do perfil', () => {
    const payload = toApiPayload(
      { sleepStart: '2026-01-09T23:00', sleepEnd: '2026-01-10T07:00', quality: 4, notes: null },
      'Asia/Tokyo',
    );
    expect(payload.sleepStart).toBe('2026-01-09T14:00:00.000Z'); // 23:00 em Tóquio
    expect(payload.sleepEnd).toBe('2026-01-09T22:00:00.000Z'); // 07:00 em Tóquio
  });

  it('toApiPayload sem fuso continua no horário do aparelho (comportamento antigo)', () => {
    const payload = toApiPayload({ sleepStart: '2026-01-09T23:00', sleepEnd: '2026-01-10T07:00', quality: 4, notes: null });
    expect(payload.sleepStart).toBe(new Date('2026-01-09T23:00').toISOString());
    expect(payload.sleepEnd).toBe(new Date('2026-01-10T07:00').toISOString());
  });
});

describe('duração ao vivo da tela Registrar (issue #212)', () => {
  it('minutosEntre calcula no fuso do perfil, não no do aparelho', () => {
    // 09/01 23:00 → 10/01 07:00 em Tóquio = 8h
    expect(minutosEntre('2026-01-09T23:00', '2026-01-10T07:00', 'Asia/Tokyo')).toBe(480);
    // os mesmos valores em São Paulo também são 8h (a duração não muda),
    // mas o instante sim — o que importa é não depender do fuso do aparelho
    expect(minutosEntre('2026-01-09T23:00', '2026-01-10T07:00', 'America/Sao_Paulo')).toBe(480);
  });

  it('minutosEntre devolve null com lado faltando, inválido ou invertido', () => {
    expect(minutosEntre('', '2026-01-10T07:00', 'UTC')).toBeNull();
    expect(minutosEntre('2026-01-09T23:00', '', 'UTC')).toBeNull();
    expect(minutosEntre('lixo', '2026-01-10T07:00', 'UTC')).toBeNull();
    // acordar antes de dormir não tem duração
    expect(minutosEntre('2026-01-10T07:00', '2026-01-09T23:00', 'UTC')).toBeNull();
  });

  it('formatarDuracaoLonga usa o formato do mockup', () => {
    expect(formatarDuracaoLonga(450)).toBe('7h 30min'); // 7h30 do mockup
    expect(formatarDuracaoLonga(480)).toBe('8h');
    expect(formatarDuracaoLonga(45)).toBe('45min');
    expect(formatarDuracaoLonga(0)).toBe('0min');
  });

  it('formatarDuracaoCurta é o formato compacto do histórico', () => {
    expect(formatarDuracaoCurta(450)).toBe('7h30');
    expect(formatarDuracaoCurta(480)).toBe('8h');
    expect(formatarDuracaoCurta(45)).toBe('45min');
    expect(formatarDuracaoCurta(0)).toBe('0min');
  });

  it('porcentagemDaMeta corta em 100 e aceita meta zerada', () => {
    expect(porcentagemDaMeta(450, 480)).toBe(94);
    expect(porcentagemDaMeta(600, 480)).toBe(100);
    expect(porcentagemDaMeta(100, 0)).toBe(0);
  });

  it('rotuloDiaRelativo marca hoje/ontem e usa dd/MM no resto', () => {
    expect(rotuloDiaRelativo('2026-01-10', '2026-01-10')).toBe('hoje');
    expect(rotuloDiaRelativo('2026-01-09', '2026-01-10')).toBe('ontem');
    expect(rotuloDiaRelativo('2026-01-08', '2026-01-10')).toBe('08/01');
  });
});
