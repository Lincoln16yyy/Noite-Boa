import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCountUp } from './useCountUp';

/** Liga/desliga a simulação de prefers-reduced-motion no matchMedia mockado. */
function simularPreferencia(reduce: boolean) {
  vi.mocked(window.matchMedia).mockImplementation(
    (query: string) =>
      ({
        matches: reduce,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );
}

describe('useCountUp (issue #216)', () => {
  beforeEach(() => {
    // Relógio falso com requestAnimationFrame: o tempo avança só quando
    // testamos, então a contagem é determinística.
    vi.useFakeTimers({ toFake: ['performance', 'requestAnimationFrame', 'cancelAnimationFrame'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('com menos movimento, devolve o alvo direto (sem contar)', () => {
    simularPreferencia(true);
    const { result } = renderHook(() => useCountUp(7.5));

    expect(result.current).toBe(7.5);

    // Nenhum quadro de animação foi agendado.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('com menos movimento, segue o alvo novo já na primeira renderização (sem passar por 0)', () => {
    // Reproduz o carregamento de verdade: a tela monta sem dados (alvo 0) e o
    // valor só chega depois. Com o alvo guardado no estado, o primeiro render
    // com o alvo novo ainda devolvia 0 e o efeito corrigia depois — um quadro
    // `0h` antes do valor final, o salto que a issue #216 manda evitar.
    // Registramos cada render aqui dentro, porque é durante o render que o valor
    // errado aparece (o efeito que o corrige só roda depois).
    simularPreferencia(true);
    const renders: Array<{ alvo: number; valor: number }> = [];
    const { rerender } = renderHook(
      ({ alvo }) => {
        const valor = useCountUp(alvo);
        renders.push({ alvo, valor });
        return valor;
      },
      { initialProps: { alvo: 0 } },
    );

    renders.length = 0; // descarta a montagem, feita ainda sem dados
    rerender({ alvo: 7.5 });

    expect(renders.length).toBeGreaterThan(0);
    // Todo render com o alvo novo já mostra o alvo novo — nunca 0 de novo.
    expect(renders.filter((r) => r.alvo === 7.5 && r.valor !== 7.5)).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('começa em zero e termina no alvo, passando por valores intermediários', () => {
    simularPreferencia(false);
    const { result } = renderHook(() => useCountUp(8));

    expect(result.current).toBe(0);

    act(() => vi.advanceTimersByTime(200));
    const meio = result.current;
    expect(meio).toBeGreaterThan(0);
    expect(meio).toBeLessThan(8);

    act(() => vi.advanceTimersByTime(500));
    expect(result.current).toBe(8);
  });

  it('termina exatamente no alvo mesmo com valores fracionários', () => {
    simularPreferencia(false);
    const { result } = renderHook(() => useCountUp(7.5));

    act(() => vi.advanceTimersByTime(700));
    expect(result.current).toBe(7.5);
  });

  it('cancela o quadro pendente ao desmontar (sem vazamento)', () => {
    simularPreferencia(false);
    const { result, unmount } = renderHook(() => useCountUp(8));

    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBeGreaterThan(0);

    unmount();

    // Rodar o tempo depois de desmontar não pode tocar em nada quebrado.
    expect(() => act(() => vi.advanceTimersByTime(500))).not.toThrow();
  });

  it('reconta quando o alvo muda (troca de período)', () => {
    simularPreferencia(false);
    const { result, rerender } = renderHook(({ alvo }) => useCountUp(alvo), {
      initialProps: { alvo: 8 },
    });

    act(() => vi.advanceTimersByTime(700));
    expect(result.current).toBe(8);

    rerender({ alvo: 6 });
    act(() => vi.advanceTimersByTime(700));
    expect(result.current).toBe(6);
  });
});
