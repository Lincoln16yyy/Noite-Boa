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
 * O efeito depende do caminho da rota de propósito: quem conclui ou pula o
 * fluxo é levado para /hoje, o efeito roda de novo, encontra o indicador no
 * aparelho e desliga — sem isso haveria um redirecionamento de ida e volta
 * entre /hoje e /onboarding.
 */
export function usePrimeiroUso(): PrimeiroUsoEstado {
  const location = useLocation();
  const [estado, setEstado] = useState<PrimeiroUsoEstado>(() =>
    onboardingConcluido() ? { verificando: false, precisa: false } : { verificando: true, precisa: false },
  );

  useEffect(() => {
    if (onboardingConcluido()) {
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
  }, [location.pathname]);

  return estado;
}
