import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import Skeleton from './Skeleton';

describe('Skeleton (issue #214)', () => {
  it('renderiza um bloco decorativo, fora da árvore de acessibilidade', () => {
    const { container } = render(<Skeleton />);
    const bloco = container.querySelector('.ui-skeleton');
    expect(bloco).not.toBeNull();
    expect(bloco).toHaveAttribute('aria-hidden', 'true');
  });

  it('aceita largura, altura, raio e estilo próprios', () => {
    const { container } = render(
      <Skeleton width="200px" height="128px" radius="var(--surface-radius)" style={{ marginTop: '1rem' }} />,
    );
    const bloco = container.querySelector<HTMLElement>('.ui-skeleton');
    expect(bloco?.style.width).toBe('200px');
    expect(bloco?.style.height).toBe('128px');
    expect(bloco?.style.marginTop).toBe('1rem');
    expect(bloco?.style.borderRadius).toBe('var(--surface-radius)');
  });

  it('usa classe extra quando passada', () => {
    const { container } = render(<Skeleton className="meu-esqueleto" />);
    expect(container.querySelector('.ui-skeleton')?.className).toContain('meu-esqueleto');
  });

  it('para o brilho quando o sistema pede menos movimento', () => {
    // jsdom não aplica media query; garantimos que a regra existe no CSS.
    const css = readFileSync(resolve(process.cwd(), 'src/components/ui/ui.css'), 'utf8');
    const blocoReduzido = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(blocoReduzido).toContain('.ui-skeleton');
    expect(blocoReduzido).toMatch(/\.ui-skeleton \{\s*animation: none;/);
  });
});
