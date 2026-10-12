import { useEffect, useState } from 'react';

/**
 * Observa uma media query do navegador (ex.: `(max-width: 767px)`).
 *
 * Diferente de ler `window.innerWidth` uma vez no render, aqui usamos o motor
 * de media queries do navegador (`matchMedia`) com listener de `change`: o
 * componente re-renderiza quando a janela é redimensionada ou o celular gira,
 * sem recarregar a página (issue #157).
 *
 * @param {string} query - media query CSS, ex.: `(max-width: 767px)`
 * @returns {boolean} se a query está ativa no momento
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

    const mql = window.matchMedia(query);
    const aoMudar = (evento: MediaQueryListEvent) => setMatches(evento.matches);

    // Sincroniza caso a query tenha mudado desde a montagem.
    setMatches(mql.matches);

    // addEventListener é o padrão atual; addListener cobre navegadores antigos.
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', aoMudar);
      return () => mql.removeEventListener('change', aoMudar);
    }
    mql.addListener(aoMudar);
    return () => mql.removeListener(aoMudar);
  }, [query]);

  return matches;
}
