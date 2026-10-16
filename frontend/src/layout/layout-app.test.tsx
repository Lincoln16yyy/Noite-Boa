import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regras de layout desktop (issue #217). O jsdom não calcula caixa nem aplica
 * media query, então o que dá para provar aqui é que a regra existe, está no
 * breakpoint certo e tem o efeito pedido — e que as telas usam as classes que
 * a regra referencia (sem isso, nada acontece).
 */
const css = readFileSync(resolve(process.cwd(), 'src/layout/layout.css'), 'utf8');

/** Trecho dentro do bloco `@media (min-width: 960px) { ... }` (o último do arquivo). */
function trechoDesktop(): string {
  return css.match(/@media \(min-width: 960px\) \{([\s\S]*)\n\}/)?.[1] ?? '';
}

describe('Layout do app (issue #217)', () => {
  it('container único de 1100 px, centralizado, com o mesmo respiro lateral em tudo', () => {
    expect(css).toMatch(/\.app-container \{\s*width: 100%;\s*max-width: 1100px;\s*margin-inline: auto;\s*padding-inline: 1rem;/);
  });

  it('tela larga: coluna legível no celular, largura do container no desktop', () => {
    expect(css).toMatch(/\.app-tela-larga \{[^}]*max-width: 560px;/);
    // O Dashboard sempre teve coluna um pouco mais larga.
    expect(css).toMatch(/\.app-tela-larga--720 \{\s*max-width: 720px;/);
    expect(trechoDesktop()).toMatch(/\.app-tela-larga,\s*\.app-tela-larga--720 \{[^}]*max-width: none;/);
  });

  it('grade vira de uma para duas colunas quando passa de 960 px', () => {
    expect(css).toMatch(/\.app-grade \{[^}]*grid-template-columns: minmax\(0, 1fr\);/);
    expect(trechoDesktop()).toMatch(/\.app-grade \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\);/);
    // `minmax(0, …)`: a coluna encolhe em vez de empurrar a página com um
    // cartão largo demais.
    expect(trechoDesktop()).not.toMatch(/minmax\(auto/);
  });

  it('cada coluna tem a altura do seu conteúdo (o cartão curto não estica)', () => {
    expect(trechoDesktop()).toMatch(/\.app-grade \{[\s\S]*?align-items: start;/);
  });

  it('com uma coluna só ela ocupa a largura toda, sem metade da tela vazia', () => {
    expect(css).toMatch(/\.app-grade > \.app-coluna:only-child \{\s*grid-column: 1 \/ -1;/);
  });

  it('os cartões de uma coluna empilham com o mesmo espaçamento de 1 rem da tela', () => {
    expect(css).toMatch(/\.app-coluna \{[^}]*gap: 1rem;/);
  });

  it('o container não vira contexto de containing block nem mexe com movimento', () => {
    // Nada de transform/filter/perspective aqui: eles quebrariam o position:
    // fixed da barra inferior e do cabeçalho (issues #209 e #216).
    expect(css).not.toMatch(/transform|filter|perspective|backdrop-filter/);
  });
});
