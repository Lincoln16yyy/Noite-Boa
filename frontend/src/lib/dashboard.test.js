import { describe, expect, it } from 'vitest';
import { buildDailySeries, formatHours, formatMinutes } from './dashboard';

describe('buildDailySeries', () => {
  const today = new Date(2026, 9, 8); // 08/10/2026

  it('preenche os dias sem registro com 0 h', () => {
    const summary = { daily: [{ date: '2026-10-07', hoursSlept: 8, bedtime: '23:10' }] };
    const series = buildDailySeries(summary, 3, today);

    expect(series).toEqual([
      { date: '2026-10-06', label: '06/10', hours: 0, hasData: false },
      { date: '2026-10-07', label: '07/10', hours: 8, hasData: true },
      { date: '2026-10-08', label: '08/10', hours: 0, hasData: false },
    ]);
  });

  it('gera a quantidade certa de dias mesmo sem dados', () => {
    expect(buildDailySeries({ daily: [] }, 7, today)).toHaveLength(7);
    expect(buildDailySeries(null, 30, today)).toHaveLength(30);
  });

  it('cruza o mês corretamente', () => {
    const series = buildDailySeries({ daily: [] }, 3, new Date(2026, 10, 1)); // 01/11/2026
    expect(series.map((d) => d.label)).toEqual(['30/10', '31/10', '01/11']);
  });

  it('calcula os dias no fuso do perfil, não no do aparelho (issue #102)', () => {
    const instante = new Date('2026-01-10T02:00:00Z'); // SP: ainda 09/01 · Tokyo: já 10/01
    const sp = buildDailySeries(null, 2, instante, 'America/Sao_Paulo');
    expect(sp.map((d) => d.date)).toEqual(['2026-01-08', '2026-01-09']);
    const tokyo = buildDailySeries(null, 2, instante, 'Asia/Tokyo');
    expect(tokyo.map((d) => d.date)).toEqual(['2026-01-09', '2026-01-10']);
    expect(tokyo[1].label).toBe('10/01');
  });

  it('casa com o que o back-end agrupou no fuso do perfil', () => {
    // o resumo vem agrupado por dia local do perfil; a série do fuso certo
    // encaixa as barras nas datas certas
    const instante = new Date('2026-01-10T02:00:00Z');
    const summary = { daily: [{ date: '2026-01-09', hoursSlept: 7, bedtime: '23:00' }] };
    const sp = buildDailySeries(summary, 2, instante, 'America/Sao_Paulo');
    expect(sp[1]).toMatchObject({ date: '2026-01-09', hours: 7, hasData: true });
    const tokyo = buildDailySeries(summary, 2, instante, 'Asia/Tokyo');
    expect(tokyo[0]).toMatchObject({ date: '2026-01-09', hours: 7, hasData: true });
    expect(tokyo[1]).toMatchObject({ date: '2026-01-10', hours: 0, hasData: false });
  });
});

describe('formatação de métricas', () => {
  it('formatHours', () => {
    expect(formatHours(7.42)).toBe('7h25');
    expect(formatHours(8)).toBe('8h');
    expect(formatHours(0)).toBe('0h');
  });

  it('formatMinutes', () => {
    expect(formatMinutes(210)).toBe('3h30');
    expect(formatMinutes(45)).toBe('0h45');
    expect(formatMinutes(0)).toBe('0h');
  });
});
