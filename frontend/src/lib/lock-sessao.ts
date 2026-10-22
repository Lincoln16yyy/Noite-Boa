/** Nome do lock que serializa as escritas do token entre abas (#293). */
export const LOCK_SESSAO = 'noiteboa-sessao';

/** Quantas vezes pedimos o lock antes de abrir mão da serialização. */
const TENTATIVAS_DE_LOCK = 2;

type NavigatorComLocks = Navigator & {
  locks?: { request: (nome: string, callback: () => unknown) => Promise<unknown> };
};

/**
 * Executa `acao` sob o lock de sessão.
 *
 * `localStorage` não tem compare-and-swap: conferir e remover o token nunca é
 * atômico. Sem um lock, a limpeza de uma aba pode remover o token que outra
 * aba acabou de gravar (review do PR #292). Por isso toda escrita do token
 * (login, logout, 401 e exclusão da conta) passa por aqui (#293). O lock vale
 * entre abas que rodam esta versão do bundle — veja o limite abaixo.
 *
 * Sem a API de Web Locks (navegador antigo, jsdom sem shim), executa direto:
 * é o comportamento anterior, sem a garantia entre abas. A função continua
 * assíncrona para que os chamadores não dependam de qual caminho rodou.
 *
 * Se o pedido do lock em si falhar (documento inativo, política do navegador),
 * tenta mais uma vez e então devolve erro. Outra aba segurando o lock não
 * rejeita o pedido — ele entra na fila; a rejeição significa que o gerenciador
 * de locks não está disponível, e executar sem ele abriria a corrida que este
 * módulo existe para fechar. Quem chama decide o que mostrar (a sessão fica
 * intacta para tentar de novo).
 *
 * Limite conhecido: uma aba com bundle anterior ao #293 não pede este lock.
 * Como `localStorage` não tem compare-and-swap, não dá para serializar com
 * código que não coopera; resta ao evento `storage` alinhar a interface ao
 * token final.
 */
export async function comLockDeSessao<T>(acao: () => T | Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : (navigator as NavigatorComLocks).locks;
  if (!locks || typeof locks.request !== 'function') return await acao();

  let ultimaFalha: unknown;
  for (let tentativa = 1; tentativa <= TENTATIVAS_DE_LOCK; tentativa += 1) {
    let entrou = false;
    try {
      return (await locks.request(LOCK_SESSAO, () => {
        entrou = true;
        return acao();
      })) as T;
    } catch (erro) {
      // Se a ação já começou, o erro é dela: repetir duplicaria a escrita.
      if (entrou) throw erro;
      ultimaFalha = erro;
    }
  }

  throw new Error('Não foi possível concluir a operação de sessão. Tente de novo.', {
    cause: ultimaFalha,
  });
}
