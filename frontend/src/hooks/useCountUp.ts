import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/**
 * Conta de zero até `alvo` numa duração curta, com ease-out (issue #216,
 * seção 6 do guia: "números contam").
 *
 * Serve para os números de destaque (duração da última noite, média do
 * Dashboard). A contagem é só apresentação: o valor de verdade é `alvo`, e é
 * o que vale para leitores de tela e testes — quem precisa do número final
 * deve ler `alvo`, não o retorno deste hook.
 *
 * Com `prefers-reduced-motion` ligado devolve `alvo` direto, sem passar por
 * `requestAnimationFrame` (mesma semântica do CSS que desliga as animações).
 *
 * @param alvo - valor final, em horas (passe o mesmo número que formata)
 * @param duracaoMs - duração da contagem (padrão 600 ms, como o anel)
 * @returns o valor em animação; `alvo` quando termina ou sem movimento
 */
export function useCountUp(alvo: number, duracaoMs = 600): number {
  const reduzido = usePrefersReducedMotion();
  const [valor, setValor] = useState(0);

  useEffect(() => {
    if (reduzido) {
      // Alinha o estado caso a pessoa ligue a animação com o app aberto.
      setValor(alvo);
      return undefined;
    }

    const inicio = performance.now();
    let quadro = 0;

    // O timestamp recebido de rAF NÃO é confiável para medir o intervalo: em
    // alguns ambientes (jsdom, e navegadores com clock skew) ele tem base de
    // tempo diferente da `performance.now()`, o que dava tempo negativo e a
    // contagem começava com número errado. Lemos o relógio aqui dentro.
    const passo = () => {
      const decorrido = Math.min(1, Math.max(0, (performance.now() - inicio) / duracaoMs));
      // Ease-out cúbico: rápido no começo, devagar no fim (sem desaceleração
      // abrupta). Cubo evita a sensação de "travado" do linear.
      const suavizado = 1 - (1 - decorrido) ** 3;
      setValor(alvo * suavizado);
      if (decorrido < 1) quadro = requestAnimationFrame(passo);
    };

    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [alvo, duracaoMs, reduzido]);

  // Sem movimento devolvemos o alvo direto, fora do estado: o estado começa em
  // 0 (a primeira renderização costuma ainda estar carregando), e devolvê-lo
  // por um quadro daria o salto `0h → 7h30` que a issue manda evitar.
  return reduzido ? alvo : valor;
}

export default useCountUp;
