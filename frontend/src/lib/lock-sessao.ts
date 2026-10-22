/** Nome do lock que serializa as escritas do token entre abas (#293). */
export const LOCK_SESSAO = 'noiteboa-sessao';

type NavigatorComLocks = Navigator & {
  locks?: { request: (nome: string, callback: () => unknown) => Promise<unknown> };
};

/**
 * Executa `acao` sob o lock de sessão.
 *
 * `localStorage` não tem compare-and-swap: conferir e remover o token nunca é
 * atômico. Sem um lock, a limpeza de uma aba pode remover o token que outra
 * aba acabou de gravar (review do PR #292). Por isso toda escrita do token
 * (login, logout, 401 e exclusão da conta) passa por aqui (#293).
 *
 * Sem a API de Web Locks (navegador antigo, jsdom sem shim), executa direto:
 * é o comportamento anterior, sem a garantia entre abas. A função continua
 * assíncrona para que os chamadores não dependam de qual caminho rodou.
 */
export async function comLockDeSessao<T>(acao: () => T | Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : (navigator as NavigatorComLocks).locks;
  if (!locks || typeof locks.request !== 'function') return await acao();
  return (await locks.request(LOCK_SESSAO, () => acao())) as T;
}
