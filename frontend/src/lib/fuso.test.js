import { describe, expect, it } from 'vitest';
import {
  formatarNoFuso,
  isoDateNoFuso,
  localInputNoFuso,
  menosDiasIso,
  parseNoFuso,
  partesNoFuso,
} from './fuso';

// Fusos deterministicos: America/Sao_Paulo (UTC-3, sem DST desde 2019) e
// Asia/Tokyo (UTC+9, sem DST). O instante de 02:00Z cai em dias DIFERENTES
// nos dois — é a virada de dia que o bug da issue #102 confundia.
const INSTANTE = new Date('2026-01-10T02:00:00Z'); // SP: 09/01 23:00 · Tokyo: 10/01 11:00

describe('partesNoFuso', () => {
  it('separa o dia certo na virada (mesmo instante, dias diferentes)', () => {
    expect(isoDateNoFuso(INSTANTE, 'America/Sao_Paulo')).toBe('2026-01-09');
    expect(isoDateNoFuso(INSTANTE, 'Asia/Tokyo')).toBe('2026-01-10');
  });

  it('devolve hora 0 à meia-noite, não 24', () => {
    const p = partesNoFuso(new Date('2026-01-10T03:00:00Z'), 'America/Sao_Paulo'); // 00:00 em SP
    expect(p).toEqual({ ano: 2026, mes: 1, dia: 10, hora: 0, minuto: 0 });
  });
});

describe('menosDiasIso', () => {
  it('cruza mês e ano', () => {
    expect(menosDiasIso('2026-03-01', 1)).toBe('2026-02-28');
    expect(menosDiasIso('2026-01-01', 1)).toBe('2025-12-31');
    expect(menosDiasIso('2026-10-08', 6)).toBe('2026-10-02');
  });
});

describe('parseNoFuso', () => {
  it('interpreta a hora digitada como parede no fuso do perfil', () => {
    expect(parseNoFuso('2026-01-09T23:00', 'America/Sao_Paulo').toISOString()).toBe('2026-01-10T02:00:00.000Z');
    expect(parseNoFuso('2026-01-10T23:00', 'Asia/Tokyo').toISOString()).toBe('2026-01-10T14:00:00.000Z');
  });
});

describe('ida e volta com o fuso', () => {
  it('localInputNoFuso e parseNoFuso se reencontram', () => {
    const iso = '2026-07-15T03:30:00.000Z';
    expect(localInputNoFuso(new Date(iso), 'Asia/Tokyo')).toBe('2026-07-15T12:30');
    expect(parseNoFuso('2026-07-15T12:30', 'Asia/Tokyo').toISOString()).toBe(iso);
    expect(localInputNoFuso(new Date(iso), 'America/Sao_Paulo')).toBe('2026-07-15T00:30');
    expect(parseNoFuso('2026-07-15T00:30', 'America/Sao_Paulo').toISOString()).toBe(iso);
  });
});

describe('formatarNoFuso', () => {
  it('formata a exibição no fuso do perfil', () => {
    expect(formatarNoFuso('2026-01-10T02:00:00Z', 'America/Sao_Paulo')).toBe('09/01 23h00');
    expect(formatarNoFuso('2026-01-10T02:00:00Z', 'Asia/Tokyo')).toBe('10/01 11h00');
  });
});
