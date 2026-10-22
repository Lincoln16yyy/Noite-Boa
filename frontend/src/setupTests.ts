// Mock matchMedia for jsdom (not implemented in jsdom)
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// jsdom não implementa Web Locks. O app serializa as escritas do token por um
// lock nomeado entre abas (#293); o shim reproduz a fila por nome para os
// testes verem o mesmo entrelaçamento do navegador. Testes do fallback
// removem a propriedade.
if (!('locks' in navigator)) {
  const filas = new Map<string, Promise<unknown>>();
  // Quais locks estão com o callback em execução agora. Os testes usam isto
  // para provar que um efeito rodou DENTRO do lock, não logo depois (#310).
  const emExecucao = new Set<string>();
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      emExecucao,
      request(nome: string, opcoesOuCallback: unknown, talvezCallback?: () => unknown) {
        const callback =
          typeof opcoesOuCallback === 'function'
            ? (opcoesOuCallback as () => unknown)
            : talvezCallback;
        if (!callback) throw new Error('request sem callback');
        const anterior = filas.get(nome) ?? Promise.resolve();
        const atual = anterior.then(async () => {
          emExecucao.add(nome);
          try {
            return await callback();
          } finally {
            emExecucao.delete(nome);
          }
        });
        // A fila não pode carregar a rejeição de uma operação para a próxima.
        filas.set(
          nome,
          atual.then(
            () => undefined,
            () => undefined,
          ),
        );
        return atual;
      },
    },
  });
}
