import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import Ring from './Ring';
import ProgressBar from './ProgressBar';

/**
 * Regras de movimento (issue #216, seção 6 do guia). O jsdom não aplica media
 * query nem roda animação CSS, então o que dá para provar aqui é: (a) a regra
 * de animação existe no CSS, (b) a mesma regra é desligada em
 * `prefers-reduced-motion`, e (c) os componentes usam as classes e custom
 * properties que a animação referencia — sem isso a animação não roda.
 */
const css = readFileSync(resolve(process.cwd(), 'src/components/ui/ui.css'), 'utf8');

/** Trecho dentro do bloco `@media (prefers-reduced-motion: reduce) { ... }`. */
function trechoReduzido(): string {
  return css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\n\}/)?.[1] ?? '';
}

describe('Movimento (issue #216)', () => {
  describe('animações de entrada existem no CSS', () => {
    it('anel preenche em ~600 ms', () => {
      expect(css).toMatch(/\.ui-ring__value \{[\s\S]*?animation: ui-ring-fill 0\.6s ease;/);
      expect(css).toMatch(/@keyframes ui-ring-fill \{\s*from \{ stroke-dashoffset: var\(--ui-ring-cheio, 0\); \}/);
    });

    it('barra de progresso cresce em ~400 ms', () => {
      expect(css).toMatch(/\.ui-progress__fill \{[\s\S]*?animation: ui-progress-fill 0\.4s ease;/);
      expect(css).toMatch(/@keyframes ui-progress-fill \{\s*from \{ width: 0; \}/);
    });

    it('barras do gráfico crescem em ~400 ms', () => {
      expect(css).toMatch(/\.ui-bar-grow \{[\s\S]*?animation: ui-bar-grow 0\.4s ease;/);
      expect(css).toMatch(/@keyframes ui-bar-grow \{\s*from \{ height: 0; \}/);
    });

    it('troca de tela desliza para cima e some ao assentar (sem `forwards`)', () => {
      expect(css).toMatch(/\.ui-screen-enter \{[\s\S]*?animation: ui-screen-enter 0\.25s ease;/);
      // Sem `forwards`: depois da animação o elemento volta a `none`, para não
      // criar contexto de containing block permanente.
      expect(css).not.toMatch(/animation: ui-screen-enter[^;]*forwards/);
    });
  });

  describe('tudo desligado com prefers-reduced-motion', () => {
    it('anel, barra, barras do gráfico e troca de tela nascem no estado final', () => {
      const reduzido = trechoReduzido();
      for (const seletor of ['.ui-ring__value', '.ui-progress__fill', '.ui-bar-grow', '.ui-screen-enter']) {
        expect(reduzido).toContain(seletor);
      }
      expect(reduzido).toMatch(
        /\.ui-ring__value,\s*\.ui-progress__fill,\s*\.ui-bar-grow,\s*\.ui-screen-enter \{\s*animation: none;/,
      );
    });

    it('brilho do skeleton também some', () => {
      expect(trechoReduzido()).toMatch(/\.ui-skeleton \{\s*animation: none;/);
    });

    it('botão, chip e barra não têm transição nem afundam', () => {
      const blocoSemMovimento = trechoReduzido();
      expect(blocoSemMovimento).toMatch(
        /\.ui-btn,\s*\.ui-icon-btn,\s*\.ui-chip,\s*\.ui-progress__fill,\s*\.ui-ring__value \{\s*transition: none;/,
      );
      expect(blocoSemMovimento).toMatch(/\.ui-btn:active:not\(:disabled\)[\s\S]*?transform: none;/);
    });
  });

  describe('sem salto de layout', () => {
    it('a animação do anel só mexe em stroke-dashoffset (não afeta layout)', () => {
      const trecho = css.match(/@keyframes ui-ring-fill \{([\s\S]*?)\n\}/)?.[1] ?? '';
      expect(trecho).not.toMatch(/width|height|margin|padding|top|left|bottom|right/);
    });

    it('a animação da barra de progresso só mexe em width, dentro do trilho', () => {
      const trecho = css.match(/@keyframes ui-progress-fill \{([\s\S]*?)\n\}/)?.[1] ?? '';
      expect(trecho.trim()).toBe('from { width: 0; }');
      // O trilho tem altura fixa e overflow hidden: crescer a largura não
      // desloca os vizinhos.
      expect(css).toMatch(/\.ui-progress \{[\s\S]*?overflow: hidden;/);
    });
  });

  describe('componentes disparam a animação', () => {
    it('Ring expõe --ui-ring-cheio (a circunferência vazia) para o keyframe', () => {
      const { container } = render(<Ring label="Meta" value={75} size={100} strokeWidth={10} />);
      const anel = container.querySelector<HTMLElement>('.ui-ring');
      const circunferencia = 2 * Math.PI * ((100 - 10) / 2);
      expect(Number(anel?.style.getPropertyValue('--ui-ring-cheio'))).toBeCloseTo(circunferencia, 3);
    });

    it('ProgressBar mantém a largura final no DOM (a animação é só apresentação)', () => {
      const { container } = render(<ProgressBar value={72} label="Progresso" />);
      const preenchido = container.querySelector<HTMLElement>('.ui-progress__fill');
      expect(preenchido?.style.width).toBe('72%');
    });

    it('as barras do gráfico usam a classe .ui-bar-grow', () => {
      // Garante que quem renderiza barra não esquece a classe que anima.
      const dashboard = readFileSync(resolve(process.cwd(), 'src/pages/Dashboard.tsx'), 'utf8');
      expect(dashboard).toContain('ui-bar-grow');
      const hoje = readFileSync(resolve(process.cwd(), 'src/pages/Hoje.tsx'), 'utf8');
      expect(hoje).toContain('ui-bar-grow');
    });
  });
});
