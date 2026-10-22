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
  it('tenta de novo e só então executa direto se o lock falhar (review do #310)', async () => {
    const request = vi.fn().mockRejectedValue(new Error('documento inativo'));
    const restaurar = comLocksFalsos({ request });
    const acao = vi.fn(() => 'ok');
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      // Um lock indisponível não pode prender a pessoa na conta: a ação roda
      // direto, como no fallback de navegador antigo.
      await expect(comLockDeSessao(acao)).resolves.toBe('ok');
      expect(request).toHaveBeenCalledTimes(2); // a rejeição veio do lock, não do caminho direto
      expect(acao).toHaveBeenCalledTimes(1);
      expect(aviso).toHaveBeenCalledTimes(1); // estado degradado fica visível
    } finally {
      restaurar();
      aviso.mockRestore();
    }
  });

  it('retenta o lock e usa o callback quando a segunda tentativa funciona (#310)', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error('falha transitória'))
      .mockImplementationOnce((_nome: string, callback: () => unknown) => Promise.resolve(callback()));
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

  it('não repete a ação quando o erro veio dela (review do #310)', async () => {
    const erro = new Error('falha da ação');
    const acao = vi.fn(() => {
      throw erro;
    });

    await expect(comLockDeSessao(acao)).rejects.toBe(erro);
    expect(acao).toHaveBeenCalledTimes(1);
  });
});
