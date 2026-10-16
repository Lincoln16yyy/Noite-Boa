import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { onboardingConcluido, precisaDePrimeiroUso } from '../lib/primeiro-uso';

export interface PrimeiroUsoEstado {
  /** a consulta ao servidor ainda não terminou */
  verificando: boolean;
  /** este aparelho está no primeiro uso */
  precisa: boolean;
}

/**
 * Decide se o fluxo de primeiro uso deve aparecer (issue #215).
 *
 * `sessaoAtiva` é o que autoriza a consulta: o primeiro uso é uma propriedade
 * da CONTA (sem noite e sem meta), então fora de uma sessão logada não há o
 * que perguntar.
 *
 * O efeito depende do caminho da rota de propósito: quem conclui ou pula o
 * fluxo é levado para /hoje, o efeito roda de novo, encontra o indicador no
 * aparelho e desliga — sem isso haveria um redirecionamento de ida e volta
 * entre /hoje e /onboarding.
 */
export function usePrimeiroUso(sessaoAtiva: boolean): PrimeiroUsoEstado {
  const location = useLocation();
  const [estado, setEstado] = useState<PrimeiroUsoEstado>(() =>
    onboardingConcluido() ? { verificando: false, precisa: false } : { verificando: true, precisa: false },
  );

  useEffect(() => {
    // Sem sessão não há quem perguntar: em /login e /cadastro a sonda levaria
    // 401, e memoizar esse "não é primeiro uso" esconderia o fluxo de quem
    // acabou de criar a conta (pegado no teste ponta a ponta com a API real).
    if (!sessaoAtiva || onboardingConcluido()) {
      setEstado({ verificando: false, precisa: false });
      return;
    }
    let ativo = true;
    void precisaDePrimeiroUso().then((precisa) => {
      if (ativo) setEstado({ verificando: false, precisa });
    });
    return () => {
      ativo = false;
    };
  }, [location.pathname, sessaoAtiva]);

  return estado;
}
