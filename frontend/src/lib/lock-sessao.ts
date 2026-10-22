/** Nome do lock que serializa as escritas do token entre abas (#293). */
export const LOCK_SESSAO = 'noiteboa-sessao';

/** Quantas vezes pedimos o lock antes de abrir mão da serialização. */
const TENTATIVAS_DE_LOCK = 2;

/** Quanto esperamos o lock antes de desistir (aba presa segurando o lock). */
const TEMPO_MAX_LOCK = 5000;

type NavigatorComLocks = Navigator & {
  locks?: {
    request: (
      nome: string,
      opcoes: { signal: AbortSignal },
      callback: () => unknown,
    ) => Promise<unknown>;
  };
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
 * assíncrona para que os chamadores não dependam de qual caminho rodou. Nesse
 * caminho avisa uma vez no console: operadores precisam saber que a
 * serialização entre abas não está valendo (review do #310).
 *
 * Se o pedido do lock em si falhar (documento inativo, política do navegador),
 * tenta mais uma vez e então devolve erro. Outra aba segurando o lock não
 * rejeita o pedido — ele entra na fila; a rejeição significa que o gerenciador
 * de locks não está disponível, e executar sem ele abriria a corrida que este
 * módulo existe para fechar. Quem chama decide o que mostrar (a sessão fica
 * intacta para tentar de novo).
 *
 * A espera é limitada: se a aba que segura o lock estiver suspensa, o pedido
 * fica preso para sempre sem isto. Depois de `TEMPO_MAX_LOCK` desistimos sem
 * rodar a ação (a sessão fica intacta), em vez de deixar login/logout/401
 * pendurados sem mensagem (review do #310).
 *
 * Limite conhecido: uma aba com bundle anterior ao #293 não pede este lock.
 * Como `localStorage` não tem compare-and-swap, não dá para serializar com
 * código que não coopera; resta ao evento `storage` alinhar a interface ao
 * token final.
 */
let avisouSemLock = false;

export async function comLockDeSessao<T>(acao: () => T | Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : (navigator as NavigatorComLocks).locks;
  if (!locks || typeof locks.request !== 'function') {
    if (!avisouSemLock) {
      avisouSemLock = true;
      console.warn(
        '[sessao] Web Locks indisponível: as escritas do token não estão serializadas entre abas.',
      );
    }
    return await acao();
  }

  let ultimaFalha: unknown;
  for (let tentativa = 1; tentativa <= TENTATIVAS_DE_LOCK; tentativa += 1) {
    let entrou = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TEMPO_MAX_LOCK);
    try {
      return (await locks.request(LOCK_SESSAO, { signal: controller.signal }, () => {
        entrou = true;
        return acao();
      })) as T;
    } catch (erro) {
      // Se a ação já começou, o erro é dela: repetir duplicaria a escrita.
      if (entrou) throw erro;
      ultimaFalha = erro;
      // Desistimos por tempo: repetir agora só esperaria mais um prazo.
      if (controller.signal.aborted) break;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error('Não foi possível concluir a operação de sessão. Tente de novo.', {
    cause: ultimaFalha,
  });
}
