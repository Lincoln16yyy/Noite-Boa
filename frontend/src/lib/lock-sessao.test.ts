import { describe, expect, it, vi } from 'vitest';
import { comLockDeSessao } from './lock-sessao';

/** Troca o `navigator.locks` pelo objeto dado e devolve a restauração. */
function comLocksFalsos(value: unknown): () => void {
  const nav = navigator as unknown as { locks?: LockManager };
  const original = nav.locks;
  Object.defineProperty(navigator, 'locks', { configurable: true, value });
  return () => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: original });
  };
}

describe('comLockDeSessao', () => {
  it('avisa uma vez quando o navegador não tem Web Locks (review do #310)', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const restaurar = comLocksFalsos(undefined);

    try {
      await expect(comLockDeSessao(() => 'a')).resolves.toBe('a');
      await expect(comLockDeSessao(() => 'b')).resolves.toBe('b');
      expect(aviso).toHaveBeenCalledTimes(1);
      expect(aviso.mock.calls[0][0]).toMatch(/Web Locks indisponível/);
    } finally {
      restaurar();
      aviso.mockRestore();
    }
  });

  it('retenta e devolve erro se o lock não responder, sem rodar a ação solta (review do #310)', async () => {
    const request = vi.fn().mockRejectedValue(new Error('documento inativo'));
    const restaurar = comLocksFalsos({ request });
    const acao = vi.fn(() => 'ok');

    try {
      // Sem lock não há serialização: executar solto abriria a corrida que o
      // módulo fecha. A sessão fica intacta e quem chamou mostra o erro.
      await expect(comLockDeSessao(acao)).rejects.toThrow(/operação de sessão/);
      expect(request).toHaveBeenCalledTimes(2);
      expect(acao).not.toHaveBeenCalled();
    } finally {
      restaurar();
    }
  });

  it('retenta o lock e usa o callback quando a segunda tentativa funciona (#310)', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error('falha transitória'))
      .mockImplementationOnce(
        (_nome: string, _opcoes: { signal: AbortSignal }, callback: () => unknown) =>
          Promise.resolve(callback()),
      );
    const restaurar = comLocksFalsos({ request });
    let sobLock = false;
    const acao = vi.fn(() => {
      sobLock = true;
      return 'ok';
    });

    try {
      await expect(comLockDeSessao(acao)).resolves.toBe('ok');
      expect(request).toHaveBeenCalledTimes(2);
      expect(sobLock).toBe(true);
    } finally {
      restaurar();
    }
  });

  it('desiste quando o lock não é liberado no prazo, sem rodar a ação (review do #310)', async () => {
    vi.useFakeTimers();
    const request = vi.fn(
      (_nome: string, opcoes: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          opcoes.signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const restaurar = comLocksFalsos({ request });
    const acao = vi.fn(() => 'ok');

    try {
      const promessa = comLockDeSessao(acao);
      const falha = expect(promessa).rejects.toThrow(/operação de sessão/);
      await vi.advanceTimersByTimeAsync(5000);
      await falha;
      // Aba suspensa segurando o lock: não adianta pedir de novo no mesmo prazo.
      expect(request).toHaveBeenCalledTimes(1);
      expect(acao).not.toHaveBeenCalled();
    } finally {
      restaurar();
      vi.useRealTimers();
    }
  });

  it('não repete a ação quando o erro veio dela (review do #310)', async () => {
    const erro = new Error('falha da ação');
    const acao = vi.fn(() => {
      throw erro;
    });

    await expect(comLockDeSessao(acao)).rejects.toBe(erro);
    expect(acao).toHaveBeenCalledTimes(1);
  });
});
