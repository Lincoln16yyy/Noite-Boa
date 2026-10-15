import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/** Faz o matchMedia mockado devolver o resultado pedido na próxima leitura. */
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

describe('usePrefersReducedMotion (issue #216)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('devolve false quando o sistema não pede menos movimento', () => {
    simularPreferencia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it('devolve true quando o sistema pede menos movimento', () => {
    simularPreferencia(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it('observa a media query certa', () => {
    simularPreferencia(false);
    renderHook(() => usePrefersReducedMotion());
    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('reage quando a preferência muda com o app aberto', () => {
    let ouvinte: ((evento: MediaQueryListEvent) => void) | null = null;
    vi.mocked(window.matchMedia).mockImplementation(
      (query: string) =>
        ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: (_tipo: string, cb: EventListenerOrEventListenerObject) => {
            ouvinte = cb as (evento: MediaQueryListEvent) => void;
          },
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList,
    );

    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    act(() => ouvinte?.({ matches: true } as MediaQueryListEvent));
    expect(result.current).toBe(true);
  });
});
