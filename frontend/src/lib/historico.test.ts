import { describe, expect, it } from 'vitest';
import { agruparPorSemana, inicioDaSemana, rotuloNoite } from './historico';
import type { Noite } from './historico';

const SP = 'America/Sao_Paulo';

function noite(id: string, sleepStart: string, quality = 4): Noite {
  return { id, sleepStart, sleepEnd: sleepStart, quality };
}

describe('inícioDaSemana (issue #213)', () => {
  it('semana começa no domingo', () => {
    expect(inicioDaSemana('2026-10-12')).toBe('2026-10-11'); // segunda → domingo
    expect(inicioDaSemana('2026-10-11')).toBe('2026-10-11'); // domingo → ele mesmo
    expect(inicioDaSemana('2026-10-17')).toBe('2026-10-11'); // sábado → domingo
  });

  it('atravessa o mês e o ano', () => {
    expect(inicioDaSemana('2026-11-02')).toBe('2026-11-01'); // segunda → domingo
    expect(inicioDaSemana('2027-01-04')).toBe('2027-01-03'); // segunda → domingo
  });
});

describe('rotuloNoite (issue #213)', () => {
  it('dia da semana em pt-BR com a data', () => {
    expect(rotuloNoite('2026-10-12')).toBe('Segunda, 12/10');
    expect(rotuloNoite('2026-10-11')).toBe('Domingo, 11/10');
  });
});

describe('agruparPorSemana (issue #213)', () => {
  it('separa "Esta semana" e "Semana passada"', () => {
    // hoje = quarta 14/10/2026; semana atual começa domingo 11/10
    const grupos = agruparPorSemana(
      [
        noite('a', '2026-10-14T02:00:00Z'), // 13/10 23:00 em SP → terça, esta semana
        noite('b', '2026-10-12T02:00:00Z'), // 11/10 23:00 em SP → domingo, esta semana
        noite('c', '2026-10-08T02:00:00Z'), // 07/10 23:00 em SP → quarta, semana passada
        noite('d', '2026-10-05T02:00:00Z'), // 04/10 23:00 em SP → domingo, semana passada
      ],
      '2026-10-14',
      SP,
    );

    expect(grupos.map((g) => g.rotulo)).toEqual(['Esta semana', 'Semana passada']);
    expect(grupos[0].noites.map((n) => n.id)).toEqual(['a', 'b']);
    expect(grupos[1].noites.map((n) => n.id)).toEqual(['c', 'd']);
  });

  it('virada de semana: no domingo, a noite de sábado já é "Semana passada"', () => {
    // hoje = domingo 18/10/2026 → semana atual só contém o próprio domingo.
    // A API devolve do mais recente para o mais antigo.
    const grupos = agruparPorSemana(
      [
        noite('domingo', '2026-10-18T12:00:00Z'), // domingo 18/10
        noite('sabado', '2026-10-17T12:00:00Z'), // sábado 17/10 (semana anterior)
      ],
      '2026-10-18',
      'UTC',
    );

    expect(grupos.map((g) => g.rotulo)).toEqual(['Esta semana', 'Semana passada']);
    expect(grupos[0].noites.map((n) => n.id)).toEqual(['domingo']);
    expect(grupos[1].noites.map((n) => n.id)).toEqual(['sabado']);
  });

  it('usa o fuso do perfil, não o do aparelho', () => {
    // 2026-10-17T02:00Z: em SP é 16/10 (sexta, semana do dia 11); em Tóquio é
    // 17/10 11:00 (sábado, MESMA semana)... o que muda é a data da noite.
    const gruposSp = agruparPorSemana([noite('x', '2026-10-17T02:00:00Z')], '2026-10-14', SP);
    expect(gruposSp).toHaveLength(1);
    expect(gruposSp[0].noites).toHaveLength(1);

    // Virada de data: 17/10T02:00Z = 16/10 23:00 em SP → sexta (esta semana,
    // que começou domingo 11/10). Em Tóquio seria sábado 17/10 — mesma semana
    // aqui, mas a data do cartão é diferente: 16/10 em SP.
    const [grupo] = gruposSp;
    expect(grupo.rotulo).toBe('Esta semana');
  });

  it('semanas antigas ganham rótulo com a data', () => {
    const grupos = agruparPorSemana([noite('velha', '2026-09-20T12:00:00Z')], '2026-10-14', 'UTC');
    expect(grupos[0].rotulo).toBe('Semana de 20/09');
  });

  it('lista vazia não cria grupos', () => {
    expect(agruparPorSemana([], '2026-10-14', SP)).toEqual([]);
  });
});
