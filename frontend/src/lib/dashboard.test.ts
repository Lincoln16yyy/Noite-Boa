import { describe, expect, it } from 'vitest';
import {
  barraConsistencia,
  buildDailySeries,
  dicaDashboard,
  formatHours,
  formatMinutes,
  minutosQueFaltam,
} from './dashboard';

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

describe('regras do Dashboard v2 (issue #211)', () => {
  it('minutosQueFaltam: diferença entre meta e média, nunca negativa', () => {
    // média 7h21 com meta 8h → faltam 39 min (número do mockup)
    expect(minutosQueFaltam(7.35, 480)).toBe(39);
    // média acima da meta → 0 ("meta atingida")
    expect(minutosQueFaltam(8.5, 480)).toBe(0);
  });

  it('barraConsistencia: 60 min ou mais enchem a barra', () => {
    expect(barraConsistencia(38)).toBe(63); // 38/60
    expect(barraConsistencia(0)).toBe(0);
    expect(barraConsistencia(90)).toBe(100); // estoura: corta em 100
  });

  it('dicaDashboard: dívida 150 min → 22 min mais cedo por noite', () => {
    // X = ceil(150 / 7) = 22 (regra da seção 5)
    expect(dicaDashboard(150)).toBe(
      'Dormir 22 minutos mais cedo nas próximas 7 noites zera sua dívida de 2h30.',
    );
  });

  it('dicaDashboard: dívida 0 ou sem dado → dentro da meta', () => {
    expect(dicaDashboard(0)).toBe('Você está dentro da meta. Mantenha o ritmo!');
    expect(dicaDashboard(-15)).toBe('Você está dentro da meta. Mantenha o ritmo!');
    expect(dicaDashboard(Number.NaN)).toBe('Você está dentro da meta. Mantenha o ritmo!');
  });

  it('dicaDashboard: arredonda para cima (nunca subestima a dívida)', () => {
    // 7 min de dívida → 1 min por noite (ceil), não 0
    expect(dicaDashboard(7)).toContain('Dormir 1 minutos mais cedo');
    // 8 min → 2 min por noite
    expect(dicaDashboard(8)).toContain('Dormir 2 minutos mais cedo');
  });
});
