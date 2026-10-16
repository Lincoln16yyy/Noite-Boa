import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

/** Respostas da sonda: dá para dizer o que cada endpoint devolve. */
function instalarFetch({ comNoite, comMeta }: { comNoite: boolean; comMeta: boolean }) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const caminho = String(url);
    if (caminho.includes('/sleep-logs')) {
      return jsonResponse({ content: comNoite ? [{ id: 'n1' }] : [] });
    }
    if (caminho.includes('/goal')) {
      // /goal responde 200 com um default de 8h mesmo sem meta; o que diz se
      // ela existe é `hasGoal` (issue #215).
      return jsonResponse({ targetMinutes: 480, hasGoal: comMeta });
    }
    return jsonResponse({});
  });
}

/**
 * A sonda memoiza o resultado por sessão, então cada teste importa o módulo de
 * novo (vi.resetModules) — senão o resultado do teste anterior vaza no atual.
 */
async function carregar() {
  vi.resetModules();
  return await import('./primeiro-uso');
}

describe('indicador do primeiro uso (no aparelho)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('começa desmarcado e é marcado por quem conclui o fluxo', async () => {
    const { onboardingConcluido, marcarOnboardingConcluido } = await carregar();
    expect(onboardingConcluido()).toBe(false);
    marcarOnboardingConcluido();
    expect(onboardingConcluido()).toBe(true);
  });

  it('sobrevive ao logout: só o aparelho decide', async () => {
    const { onboardingConcluido, marcarOnboardingConcluido } = await carregar();
    marcarOnboardingConcluido();
    localStorage.removeItem('token'); // o que o logout faz
    expect(onboardingConcluido()).toBe(true);
  });

  it('sem noite e sem meta → é primeiro uso', async () => {
    const { precisaDePrimeiroUso } = await carregar();
    const fetchMock = instalarFetch({ comNoite: false, comMeta: false });
    await expect(precisaDePrimeiroUso()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('quem já registrou uma noite → não é', async () => {
    const { precisaDePrimeiroUso } = await carregar();
    instalarFetch({ comNoite: true, comMeta: false });
    await expect(precisaDePrimeiroUso()).resolves.toBe(false);
  });

  it('quem já salvou uma meta → não é, mesmo sem nenhuma noite', async () => {
    // É o caso que só `hasGoal` resolve: /goal responde 200 com 8h nos dois
    // casos, então sem o campo este teste falharia.
    const { precisaDePrimeiroUso } = await carregar();
    instalarFetch({ comNoite: false, comMeta: true });
    await expect(precisaDePrimeiroUso()).resolves.toBe(false);
  });

  it('com o indicador no aparelho não faz nenhuma chamada', async () => {
    const { marcarOnboardingConcluido, precisaDePrimeiroUso } = await carregar();
    marcarOnboardingConcluido();
    const fetchMock = instalarFetch({ comNoite: false, comMeta: false });
    await expect(precisaDePrimeiroUso()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('erro de rede não empurra ninguém para o fluxo', async () => {
    const { precisaDePrimeiroUso } = await carregar();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('rede fora'));
    await expect(precisaDePrimeiroUso()).resolves.toBe(false);
  });

  it('back-end antigo (sem hasGoal) também não empurra', async () => {
    const { precisaDePrimeiroUso } = await carregar();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const caminho = String(url);
      if (caminho.includes('/sleep-logs')) return jsonResponse({ content: [] });
      return jsonResponse({ targetMinutes: 480 }); // sem hasGoal
    });
    await expect(precisaDePrimeiroUso()).resolves.toBe(false);
  });

  it('memoiza por sessão: chamadas seguidas não refazem as requisições', async () => {
    const { precisaDePrimeiroUso } = await carregar();
    const fetchMock = instalarFetch({ comNoite: false, comMeta: false });
    await precisaDePrimeiroUso();
    await precisaDePrimeiroUso();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ao concluir o fluxo a memoização é descartada', async () => {
    const { marcarOnboardingConcluido, precisaDePrimeiroUso } = await carregar();
    instalarFetch({ comNoite: false, comMeta: false });
    await precisaDePrimeiroUso();
    marcarOnboardingConcluido();
    const chamadas = (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    await expect(precisaDePrimeiroUso()).resolves.toBe(false);
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(chamadas);
  });
});
