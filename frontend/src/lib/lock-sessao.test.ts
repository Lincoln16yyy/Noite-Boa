import { describe, expect, it, vi } from 'vitest';
import { comLockDeSessao } from './lock-sessao';

describe('comLockDeSessao', () => {
  it('executa a ação direto se o pedido do lock falhar (review do #310)', async () => {
    const nav = navigator as unknown as { locks?: LockManager };
    const original = nav.locks;
    const acao = vi.fn(() => 'ok');

    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request: vi.fn().mockRejectedValue(new Error('documento inativo')) },
    });

    try {
      // Um lock indisponível não pode prender a pessoa na conta: a ação roda
      // direto, como no fallback de navegador antigo.
      await expect(comLockDeSessao(acao)).resolves.toBe('ok');
      expect(acao).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(navigator, 'locks', { configurable: true, value: original });
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
