import { describe, expect, it } from 'vitest';
import {
  barrasDaSemana,
  comparacaoSemana,
  contagemParaDormir,
  etiquetaDia,
  normalizarMeta,
  ultimaNoite,
  META_PADRAO_MINUTOS,
} from './hoje';
import type { ResumoComAnterior } from './hoje';

// Fuso do perfil usado na maioria dos casos; instantes em UTC.
const SP = 'America/Sao_Paulo';

describe('normalizarMeta (issue #210)', () => {
  it("normaliza minutos e o alvo 'HH:mm:ss' do /goal", () => {
    expect(normalizarMeta({ targetMinutes: 480, bedtime: '23:00:00' })).toEqual({
      minutos: 480,
      dormir: '23:00',
    });
  });

  it("aceita 'HH:mm' e assume a meta padrão sem alvo", () => {
    expect(normalizarMeta({ targetMinutes: 450, bedtime: '22:30' }).dormir).toBe('22:30');
    const meta = normalizarMeta({ targetMinutes: 0 });
    expect(meta.dormir).toBe('');
    expect(meta.minutos).toBe(META_PADRAO_MINUTOS);
  });
});

describe('ultimaNoite (issue #210)', () => {
  it('pega o registro mais recente pelo início e aporcentagem da meta', () => {
    const logs = [
      { id: 'a', sleepStart: '2026-10-07T23:00:00Z', sleepEnd: '2026-10-08T07:00:00Z', quality: 4 },
      { id: 'b', sleepStart: '2026-10-08T23:30:00Z', sleepEnd: '2026-10-09T06:00:00Z', quality: 3 },
    ];
    const noite = ultimaNoite(logs, 480, SP);
    expect(noite).not.toBeNull();
    expect(noite?.minutos).toBe(390); // 6h30
    expect(noite?.porcentagem).toBe(81);
  });

  it('corta a porcentagem em 100 (dormiu mais que a meta)', () => {
    const logs = [{ id: 'a', sleepStart: '2026-10-07T23:00:00Z', sleepEnd: '2026-10-08T09:00:00Z', quality: 5 }];
    expect(ultimaNoite(logs, 480, SP)?.porcentagem).toBe(100);
  });

  it('horários de parede no fuso do perfil, não no do aparelho', () => {
    const logs = [{ id: 'a', sleepStart: '2026-10-07T23:00:00Z', sleepEnd: '2026-10-08T07:00:00Z', quality: 4 }];
    // 23:00Z = 20:00 em São Paulo (acordou 04:00)
    expect(ultimaNoite(logs, 480, SP)).toMatchObject({ dormiu: '20:00', acordou: '04:00' });
    // em Tóquio (UTC+9): 08:00 → 16:00
    expect(ultimaNoite(logs, 480, 'Asia/Tokyo')).toMatchObject({ dormiu: '08:00', acordou: '16:00' });
  });

  it('devolve null sem registros completos', () => {
    expect(ultimaNoite([], 480, SP)).toBeNull();
    expect(ultimaNoite(null, 480, SP)).toBeNull();
    expect(ultimaNoite([{ id: 'x', quality: 4 }], 480, SP)).toBeNull();
  });
});

describe('contagemParaDormir (issue #210)', () => {
  // Alvo do /goal: 23:00.
  it("antes do alvo de hoje: 'em 3h12' no fuso do perfil", () => {
    // 22:48Z = 19:48 em São Paulo → faltam 3h12 para as 23:00
    expect(contagemParaDormir('23:00', new Date('2026-10-13T22:48:00Z'), SP)).toBe('em 3h12');
  });

  it("menos de 1h fica em minutos: 'em 30 min'", () => {
    // 01:30Z = 22:30 em São Paulo → faltam 30 min para as 23:00
    expect(contagemParaDormir('23:00', new Date('2026-10-14T01:30:00Z'), SP)).toBe('em 30 min');
  });

  it("até 3h depois do alvo: 'agora'", () => {
    // 02:30Z = 23:30 em São Paulo: o alvo passou há 30 min → "agora"
    expect(contagemParaDormir('23:00', new Date('2026-10-14T02:30:00Z'), SP)).toBe('agora');
    // 02:00Z = 23:00 em São Paulo, alvo batendo agora
    expect(contagemParaDormir('23:00', new Date('2026-10-14T02:00:00Z'), SP)).toBe('agora');
  });

  it('depois de 3h do alvo: amanhã no mesmo horário', () => {
    // 06:00Z = 03:00 em São Paulo: o alvo de hoje (00:30) passou há 2h30 → "agora"
    expect(contagemParaDormir('00:30', new Date('2026-10-13T06:00:00Z'), SP)).toBe('agora');
    // 09:00Z = 06:00 em São Paulo: passou 5h30 → amanhã
    expect(contagemParaDormir('00:30', new Date('2026-10-13T09:00:00Z'), SP)).toBe('amanhã às 00:30');
  });

  it('usa o fuso do perfil: o mesmo instante dá resultados diferentes', () => {
    const instante = new Date('2026-10-13T14:48:00Z');
    // Tóquio: 23:48 (48 min depois do alvo) → "agora"
    expect(contagemParaDormir('23:00', instante, 'Asia/Tokyo')).toBe('agora');
    // São Paulo: 11:48 (faltam 11h12) → "em 11h12"
    expect(contagemParaDormir('23:00', instante, SP)).toBe('em 11h12');
  });

  it('virada de dia: madrugada ainda aponta para a noite do mesmo dia', () => {
    // 03:00Z = 00:00 em São Paulo (14/10); alvo 23:00 do dia 13/10 (parede)…
    // à meia-noite em ponto o alvo é 23h do dia corrente → "em 23h"
    expect(contagemParaDormir('23:00', new Date('2026-10-14T03:00:00Z'), SP)).toBe('em 23h');
  });

  it('sem alvo definido a contagem é vazia', () => {
    expect(contagemParaDormir('', new Date(), SP)).toBe('');
    expect(contagemParaDormir('abc', new Date(), SP)).toBe('');
  });
});

describe('barrasDaSemana e etiquetaDia (issue #210)', () => {
  const agora = new Date('2026-10-14T12:00:00Z'); // UTC: série 08/10–14/10

  it('inicial do dia da semana em pt-BR', () => {
    expect(etiquetaDia('2026-10-12', 'UTC')).toBe('S'); // segunda
    expect(etiquetaDia('2026-10-14', 'UTC')).toBe('Q'); // quarta
    expect(etiquetaDia('2026-10-11', 'UTC')).toBe('D'); // domingo
  });

  it('cor Âmbar abaixo da meta e Lavanda dentro (regra do Dashboard)', () => {
    const resumo: ResumoComAnterior = {
      averageHours: 7,
      daily: [
        { date: '2026-10-12', hoursSlept: 8.4 },
        { date: '2026-10-13', hoursSlept: 5.5 },
      ],
    };
    const barras = barrasDaSemana(resumo, 8, agora, 'UTC');
    expect(barras).toHaveLength(7);
    const porData = Object.fromEntries(barras.map((b) => [b.date, b]));

    expect(porData['2026-10-12']).toMatchObject({ cor: 'within', altura: 100, hasData: true });
    expect(porData['2026-10-13']).toMatchObject({ cor: 'below', altura: 65, hasData: true });
    // dia sem registro: trilha vazia, altura 0
    expect(porData['2026-10-10']).toMatchObject({ cor: 'within', altura: 0, hasData: false });
  });

  it('lista vazia quando não há resumo', () => {
    expect(barrasDaSemana(null, 8, agora, 'UTC')).toHaveLength(7);
    expect(barrasDaSemana(undefined, 8, agora, 'UTC').every((b) => b.altura === 0)).toBe(true);
  });
});

describe('comparacaoSemana (issue #210)', () => {
  it('mostra a diferença em minutos quando a API manda o período anterior', () => {
    const melhor = comparacaoSemana({ averageHours: 7.6, previousAverageHours: 7.23 });
    expect(melhor).toEqual({ texto: '+22 min vs. semana passada', cor: 'within' });

    const pior = comparacaoSemana({ averageHours: 6.5, previousAverageHours: 7.0 });
    expect(pior).toEqual({ texto: '−30 min vs. semana passada', cor: 'below' });
  });

  it('sem o dado (back-end da issue #206): trecho escondido', () => {
    expect(comparacaoSemana({ averageHours: 7 })).toBeNull();
    expect(comparacaoSemana(null)).toBeNull();
    expect(comparacaoSemana({ averageHours: undefined, previousAverageHours: undefined })).toBeNull();
  });
});
