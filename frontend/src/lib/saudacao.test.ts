import { describe, expect, it } from 'vitest';
import { primeiroNome, saudacao } from './saudacao';

/** Data fixa em UTC para os casos de horário. */
const em = (iso: string) => new Date(iso);

describe('saudacao (issue #209)', () => {
  it('Bom dia das 05h às 11h59 no fuso do perfil', () => {
    expect(saudacao('UTC', em('2026-06-10T05:00:00Z'))).toBe('Bom dia');
    expect(saudacao('UTC', em('2026-06-10T11:59:00Z'))).toBe('Bom dia');
  });

  it('Boa tarde das 12h às 17h59', () => {
    expect(saudacao('UTC', em('2026-06-10T12:00:00Z'))).toBe('Boa tarde');
    expect(saudacao('UTC', em('2026-06-10T17:59:00Z'))).toBe('Boa tarde');
  });

  it('Boa noite fora da faixa (madrugada e noite)', () => {
    expect(saudacao('UTC', em('2026-06-10T18:00:00Z'))).toBe('Boa noite');
    expect(saudacao('UTC', em('2026-06-10T04:59:00Z'))).toBe('Boa noite');
    expect(saudacao('UTC', em('2026-06-10T00:00:00Z'))).toBe('Boa noite');
  });

  it('usa o fuso do perfil, não o do aparelho', () => {
    // 02:00 UTC = 23:00 em São Paulo (UTC-3): noite nos dois…
    expect(saudacao('America/Sao_Paulo', em('2026-06-10T02:00:00Z'))).toBe('Boa noite');
    // …mas 10:00 UTC = 07:00 em São Paulo (Bom dia) e 10:00 UTC = 20:00 em Tóquio (JST+9, Boa noite).
    expect(saudacao('America/Sao_Paulo', em('2026-06-10T10:00:00Z'))).toBe('Bom dia');
    expect(saudacao('Asia/Tokyo', em('2026-06-10T10:00:00Z'))).toBe('Boa noite');
  });

 it('virada de ano e fuso com dia diferente do aparelho não quebram', () => {
    // 31/12 23:30 UTC já é 01/01 em Tóquio (08:30 da manhã): "Bom dia"
    // lá, mesmo sendo "Boa noite" em UTC — o fuso do perfil manda.
    expect(saudacao('Asia/Tokyo', em('2025-12-31T23:30:00Z'))).toBe('Bom dia');
    expect(saudacao('UTC', em('2025-12-31T23:30:00Z'))).toBe('Boa noite');
  });
});

describe('primeiroNome (issue #209)', () => {
  it('pega só o primeiro nome', () => {
    expect(primeiroNome('Lincoln Silva')).toBe('Lincoln');
    expect(primeiroNome('  Ana  Maria  ')).toBe('Ana');
  });

  it('devolve o nome inteiro quando não há sobrenome', () => {
    expect(primeiroNome('Teste')).toBe('Teste');
  });
});
