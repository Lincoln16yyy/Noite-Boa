import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePrimeiroUso } from './usePrimeiroUso';
import { esquecerSondagem } from '../lib/sonda';

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={['/hoje']}>{children}</MemoryRouter>;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

/**
 * Sonda com o /sleep-logs segurável. Cada instalação guarda os próprios
 * resolvers para que uma resposta atrasada da sessão anterior possa ser
 * disparada depois que a nova já começou.
 */
function sondaSeguravel({ comMeta }: { comMeta: boolean }) {
  const pendentes: Array<(resposta: Response) => void> = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const caminho = String(url);
    if (caminho.includes('/sleep-logs')) {
      return new Promise<Response>((resolve) => {
        pendentes.push(resolve);
      });
    }
    return jsonResponse({ targetMinutes: 480, hasGoal: comMeta });
  });
  return {
    responder: (comNoite: boolean) => {
      pendentes.shift()?.(jsonResponse({ content: comNoite ? [{ id: 'n1' }] : [] }));
    },
  };
}

describe('usePrimeiroUso — troca de sessão', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    esquecerSondagem();
  });

  it('não roteia a conta nova com o `precisa` da conta anterior (#292)', async () => {
    localStorage.setItem('token', 'jwt-A');
    const sondaA = sondaSeguravel({ comMeta: false });

    const { result, rerender } = renderHook(({ sessao }) => usePrimeiroUso(true, sessao), {
      wrapper,
      initialProps: { sessao: 'jwt-A' },
    });

    // Conta A é de primeiro uso: `precisa` fica true e o Layout a mandaria
    // para /onboarding.
    await act(async () => {
      sondaA.responder(false);
    });
    await waitFor(() =>
      expect(result.current).toEqual({ verificando: false, precisa: true, confirmado: true }),
    );

    // B assume a sessão nesta aba. A sonda de B ainda está em voo: o estado de
    // A não pode decidir a rota nesse meio-tempo (o Layout redirecionaria B
    // para /onboarding e a resposta false de B não a traria de volta).
    localStorage.setItem('token', 'jwt-B');
    const sondaB = sondaSeguravel({ comMeta: true });
    rerender({ sessao: 'jwt-B' });

    expect(result.current.precisa).toBe(false);
    expect(result.current.confirmado).toBe(false);

    await act(async () => {
      sondaB.responder(true);
    });
    await waitFor(() =>
      expect(result.current).toEqual({ verificando: false, precisa: false, confirmado: true }),
    );
  });

  it('descarta a resposta da sonda anterior que chega atrasada (#292)', async () => {
    localStorage.setItem('token', 'jwt-A');
    const sondaA = sondaSeguravel({ comMeta: false }); // A fica pendente

    const { result, rerender } = renderHook(({ sessao }) => usePrimeiroUso(true, sessao), {
      wrapper,
      initialProps: { sessao: 'jwt-A' },
    });
    expect(result.current.confirmado).toBe(false);

    localStorage.setItem('token', 'jwt-B');
    const sondaB = sondaSeguravel({ comMeta: true });
    rerender({ sessao: 'jwt-B' });

    // A responde atrasada dizendo "primeiro uso": a sessão já mudou, então o
    // resultado não pode ligar o fluxo para B.
    await act(async () => {
      sondaA.responder(false);
    });
    expect(result.current.precisa).toBe(false);
    expect(result.current.confirmado).toBe(false);

    await act(async () => {
      sondaB.responder(true);
    });
    await waitFor(() =>
      expect(result.current).toEqual({ verificando: false, precisa: false, confirmado: true }),
    );
  });
});
