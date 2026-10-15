import { useMediaQuery } from './useMediaQuery';

/**
 * Observa a preferência do sistema por menos movimento (issue #216, seção 6
 * do guia `docs/design/direcao-visual.md`).
 *
 * Devolve `true` quando a pessoa pediu pouca animação nas configurações do
 * sistema (Windows "mostrar animações", iOS "reduzir movimento", macOS
 * "reduzir movimento"). Nesse caso o app deve entregar o mesmo conteúdo, só
 * que sem varredura, contagem ou deslize — e sem salto de layout.
 *
 * Usa `matchMedia` (via `useMediaQuery`) em vez de checar uma vez no render,
 * para reagir quando a preferência muda com o app aberto.
 *
 * @returns {boolean} se o sistema pede menos movimento
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

export default usePrefersReducedMotion;
