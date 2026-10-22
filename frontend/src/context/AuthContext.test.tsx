import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import type { User } from '../api/types';
import { comLockDeSessao } from '../lib/lock-sessao';
import { clearSessionIfCurrent } from '../api/client';

function BotaoSair() {
  const { logout } = useAuth();
  return <button onClick={logout}>Sair</button>;
}

/** Mostra o e-mail do usuário atual (e o carregamento) para provar a sessão. */
function MostraUsuario() {
  const { user, loading } = useAuth();
  if (loading) return <p>carregando</p>;
  return <p>{user?.email ?? 'sem usuário'}</p>;
}

/** Tela mínima com o aviso de erro de sessão e o botão de retry (#294). */
function TelaComErro() {
  const { user, loading, erroSessao, tentarNovamente } = useAuth();
  if (loading) return <p>carregando</p>;
  if (erroSessao) {
    return (
      <>
        <p role="alert">{erroSessao}</p>
        <button type="button" onClick={() => void tentarNovamente()}>Tentar de novo</button>
      </>
    );
  }
  return <p>{user?.email ?? 'sem usuário'}</p>;
}

/** Tela mínima de login: guarda o erro para o teste conferir (#310). */
function TelaLogin() {
  const { login } = useAuth();
  const [erro, setErro] = useState('');
  return (
    <>
      <button
        type="button"
        onClick={() => {
          void login('a@example.com', 'senha').catch((e: Error) => setErro(e.message));
        }}
      >
        Entrar
      </button>
      {erro && <p role="alert">{erro}</p>}
    </>
  );
}

/** Imita a guarda do `Layout`: sem usuário (e sem carregar), manda para o login. */
function RotaProtegida() {
  const { user, loading } = useAuth();
  if (loading) return <p>carregando</p>;
  if (!user) return <p>login</p>;
  return <p>{user.email}</p>;
}

const usuarioA: User = {
  id: 'a1',
  email: 'a@example.com',
  displayName: 'Ana',
  timezone: 'America/Sao_Paulo',
  shareWithFriends: true,
};

const usuarioB: User = {
  id: 'b1',
  email: 'b@example.com',
  displayName: 'Bia',
  timezone: 'America/Sao_Paulo',
  shareWithFriends: true,
};

/** Respostas das duas chamadas da sonda do primeiro uso (mais o /me da sessão). */
function simularSonda({ comNoite, comMeta }: { comNoite: boolean; comMeta: boolean }) {
  vi.mocked(globalThis.fetch).mockImplementation(async (url) => {
    const caminho = String(url);
    if (caminho.includes('/api/me')) return new Response('null', { status: 200 });
    if (caminho.includes('/sleep-logs')) {
      return new Response(JSON.stringify({ content: comNoite ? [{ id: 'n1' }] : [] }), { status: 200 });
    }
    return new Response(JSON.stringify({ targetMinutes: 480, hasGoal: comMeta }), { status: 200 });
  });
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('null', { status: 200 }));
  });

  it('conta nova depois do logout é sondada de novo, sem herdar o resultado de A (#273)', async () => {
    localStorage.setItem('token', 'jwt-A');
    const { precisaDePrimeiroUso } = await import('../lib/primeiro-uso');

    simularSonda({ comNoite: false, comMeta: false });
    await expect(precisaDePrimeiroUso()).resolves.toBe(true); // conta A: primeiro uso

    render(
      <AuthProvider>
        <BotaoSair />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(localStorage.getItem('token')).toBeNull());

    // O reset do logout não pode depender do escopo por token: com o MESMO
    // token de antes, a sonda tem de ser refeita. Sem o `esquecerSondagem` do
    // `clearSession`, a memória de A responderia `true` (review do PR #292).
    simularSonda({ comNoite: true, comMeta: true });
    localStorage.setItem('token', 'jwt-A');
    await expect(precisaDePrimeiroUso()).resolves.toBe(false);

    // Conta B (token novo) também sonda do zero. O resultado de B é o OPOSTO do
    // de A, para que herdar a memória de A falhe (review do PR #292).
    simularSonda({ comNoite: false, comMeta: false });
    localStorage.setItem('token', 'jwt-B');
    await expect(precisaDePrimeiroUso()).resolves.toBe(true);
  });

  it('resposta atrasada do /me de uma conta não sobrescreve a outra (#292)', async () => {
    localStorage.setItem('token', 'jwt-A');
    let responderA: ((resposta: Response) => void) | undefined;
    let chamadasMe = 0;
    vi.mocked(globalThis.fetch).mockImplementation(async (url) => {
      if (String(url).includes('/api/me')) {
        chamadasMe += 1;
        if (chamadasMe === 1) {
          // O /me da conta A fica em voo até resolvermos.
          return new Promise<Response>((resolve) => {
            responderA = resolve;
          });
        }
        return new Response(JSON.stringify(usuarioB), { status: 200 });
      }
      return new Response('null', { status: 200 });
    });

    render(
      <AuthProvider>
        <MostraUsuario />
      </AuthProvider>,
    );

    // B assume a sessão enquanto o /me de A ainda está em voo.
    localStorage.setItem('token', 'jwt-B');
    act(() => {
      window.dispatchEvent(new CustomEvent('noiteboa:session-change'));
    });
    await screen.findByText('b@example.com');

    // A resposta de A chega atrasada: é de uma sessão que já saiu.
    await act(async () => {
      responderA?.(new Response(JSON.stringify(usuarioA), { status: 200 }));
    });

    expect(screen.getByText('b@example.com')).toBeInTheDocument();
    expect(screen.queryByText('a@example.com')).not.toBeInTheDocument();
  });

  it('token trocado durante o /me inicial refaz a consulta em vez de travar no esqueleto (#292)', async () => {
    localStorage.setItem('token', 'jwt-A');
    let responderA: ((resposta: Response) => void) | undefined;
    let chamadasMe = 0;
    vi.mocked(globalThis.fetch).mockImplementation(async (url) => {
      if (String(url).includes('/api/me')) {
        chamadasMe += 1;
        if (chamadasMe === 1) {
          return new Promise<Response>((resolve) => {
            responderA = resolve;
          });
        }
        return new Response(JSON.stringify(usuarioB), { status: 200 });
      }
      return new Response('null', { status: 200 });
    });

    render(
      <AuthProvider>
        <MostraUsuario />
      </AuthProvider>,
    );

    // Outra aba troca de conta; esta janela não recebe o `session-change` da
    // outra. O /me que estava em voo responde para a sessão antiga.
    localStorage.setItem('token', 'jwt-B');
    await act(async () => {
      responderA?.(new Response(JSON.stringify(usuarioA), { status: 200 }));
    });

    // Em vez de ficar com `loading` eterno, a janela refaz a consulta para a
    // sessão atual e mostra B.
    expect(await screen.findByText('b@example.com')).toBeInTheDocument();
  });

  it('outra aba trocando o token atualiza sessão e usuário nesta aba (#292)', async () => {
    localStorage.setItem('token', 'jwt-A');
    let responderB: ((resposta: Response) => void) | undefined;
    let chamadasMe = 0;
    vi.mocked(globalThis.fetch).mockImplementation(async (url) => {
      if (String(url).includes('/api/me')) {
        chamadasMe += 1;
        if (chamadasMe === 1) return new Response(JSON.stringify(usuarioA), { status: 200 });
        return new Promise<Response>((resolve) => {
          responderB = resolve;
        });
      }
      return new Response('null', { status: 200 });
    });

    render(
      <AuthProvider>
        <MostraUsuario />
      </AuthProvider>,
    );
    expect(await screen.findByText('a@example.com')).toBeInTheDocument();

    // Em outra aba o token foi trocado: chega só o evento `storage`.
    localStorage.setItem('token', 'jwt-B');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'token', newValue: 'jwt-B' }));
    });

    // Enquanto o /me de B não chega, a conta A não pode continuar na tela: o
    // estado volta para carregando.
    expect(await screen.findByText('carregando')).toBeInTheDocument();
    expect(screen.queryByText('a@example.com')).not.toBeInTheDocument();

    await act(async () => {
      responderB?.(new Response(JSON.stringify(usuarioB), { status: 200 }));
    });
    expect(await screen.findByText('b@example.com')).toBeInTheDocument();
  });

  it('localStorage.clear() em outra aba derruba a sessão desta (#292)', async () => {
    localStorage.setItem('token', 'jwt-A');
    vi.mocked(globalThis.fetch).mockImplementation(async (url) => {
      if (String(url).includes('/api/me')) {
        return new Response(JSON.stringify(usuarioA), { status: 200 });
      }
      return new Response('null', { status: 200 });
    });

    render(
      <AuthProvider>
        <MostraUsuario />
      </AuthProvider>,
    );
    expect(await screen.findByText('a@example.com')).toBeInTheDocument();

    // `clear()` chega com `key` nulo: qualquer chave pode ter mudado.
    localStorage.clear();
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: null }));
    });

    expect(await screen.findByText('sem usuário')).toBeInTheDocument();
  });

  it('localStorage.clear() durante o carregamento inicial sai do esqueleto (#292)', async () => {
    localStorage.setItem('token', 'jwt-A');
    // O /me inicial nunca responde: o app ficaria carregando.
    vi.mocked(globalThis.fetch).mockImplementation(
      () => new Promise<Response>(() => {}),
    );

    render(
      <AuthProvider>
        <MostraUsuario />
      </AuthProvider>,
    );
    expect(screen.getByText('carregando')).toBeInTheDocument();

    localStorage.clear();
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: null }));
    });

    // Sem token não há o que esperar: sai do esqueleto.
    expect(screen.getByText('sem usuário')).toBeInTheDocument();
    expect(screen.queryByText('carregando')).not.toBeInTheDocument();
  });

  it('logout numa tela da conta antiga não derruba a conta que entrou em outra aba (#292)', async () => {
    localStorage.setItem('token', 'jwt-A');
    let chamadasMe = 0;
    vi.mocked(globalThis.fetch).mockImplementation(async (url) => {
      if (String(url).includes('/api/me')) {
        chamadasMe += 1;
        return new Response(JSON.stringify(chamadasMe === 1 ? usuarioA : usuarioB), { status: 200 });
      }
      return new Response('null', { status: 200 });
    });

    render(
      <AuthProvider>
        <BotaoSair />
        <MostraUsuario />
      </AuthProvider>,
    );
    expect(await screen.findByText('a@example.com')).toBeInTheDocument();

    // Outra aba trocou a conta; o evento `storage` ainda não chegou aqui.
    localStorage.setItem('token', 'jwt-B');
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

    // O clique era da sessão A: o token de B sobrevive e a tela passa a B.
    expect(localStorage.getItem('token')).toBe('jwt-B');
    expect(await screen.findByText('b@example.com')).toBeInTheDocument();
  });

  it('falha ao remover o token não deixa rejeição escapar do logout (#310)', async () => {
    localStorage.setItem('token', 'jwt-A');
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify(usuarioA), { status: 200 }),
    );
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const remover = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage bloqueado');
    });

    render(
      <AuthProvider>
        <BotaoSair />
        <MostraUsuario />
      </AuthProvider>,
    );
    expect(await screen.findByText('a@example.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(erro).toHaveBeenCalled());
    // O teste prova que a falha veio da tentativa de remoção, não de um logout
    // que nem tentou limpar.
    expect(remover).toHaveBeenCalled();
    // O token não saiu: fingir logout só faria a conta voltar no próximo reload.
    expect(screen.getByText('a@example.com')).toBeInTheDocument();

    remover.mockRestore();
    erro.mockRestore();
  });

  it('logout espera o lock da sessão antes de remover o token (#293)', async () => {
    localStorage.setItem('token', 'jwt-A');
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify(usuarioA), { status: 200 }),
    );

    render(
      <AuthProvider>
        <BotaoSair />
        <MostraUsuario />
      </AuthProvider>,
    );
    expect(await screen.findByText('a@example.com')).toBeInTheDocument();

    let liberar!: () => void;
    const segurando = new Promise<void>((resolver) => {
      liberar = resolver;
    });
    const dono = comLockDeSessao(() => segurando);

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    await act(async () => {
      await Promise.resolve();
    });

    // A remoção espera o lock (#293): sem isso, uma conta que outra aba
    // gravasse no meio do clique seria apagada junto.
    expect(localStorage.getItem('token')).toBe('jwt-A');

    liberar();
    await dono;
    await waitFor(() => expect(localStorage.getItem('token')).toBeNull());
  });

  it('troca de sessão não pisca o login enquanto o /me da conta nova não chega (#297)', async () => {
    localStorage.setItem('token', 'jwt-A');
    let responderB: ((resposta: Response) => void) | undefined;
    let chamadasMe = 0;
    vi.mocked(globalThis.fetch).mockImplementation(async (url) => {
      if (String(url).includes('/api/me')) {
        chamadasMe += 1;
        if (chamadasMe === 1) return new Response(JSON.stringify(usuarioA), { status: 200 });
        return new Promise<Response>((resolve) => {
          responderB = resolve;
        });
      }
      return new Response('null', { status: 200 });
    });

    render(
      <AuthProvider>
        <BotaoSair />
        <RotaProtegida />
      </AuthProvider>,
    );
    expect(await screen.findByText('a@example.com')).toBeInTheDocument();

    // Outra aba trocou para B e esta ainda não processou o `storage`; o clique
    // de sair atualiza a sessão desta tela (sem derrubar B).
    localStorage.setItem('token', 'jwt-B');
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

    // Enquanto o /me de B está em voo, a guarda não pode achar que deslogou.
    expect(screen.queryByText('login')).not.toBeInTheDocument();
    expect(screen.getByText('carregando')).toBeInTheDocument();

    await act(async () => {
      responderB?.(new Response(JSON.stringify(usuarioB), { status: 200 }));
    });
    expect(await screen.findByText('b@example.com')).toBeInTheDocument();
  });

  it('falha de rede no /me mantém o token e o retry entra na conta (#294)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('token', 'jwt-A');
    let falhar = true;
    vi.mocked(globalThis.fetch).mockImplementation(async (url) => {
      if (String(url).includes('/api/me')) {
        if (falhar) throw new TypeError('Failed to fetch');
        return new Response(JSON.stringify(usuarioA), { status: 200 });
      }
      return new Response('null', { status: 200 });
    });

    render(<AuthProvider><TelaComErro /></AuthProvider>);

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i);
    // Falha de rede não é logout: o token (e a sessão) continuam.
    expect(localStorage.getItem('token')).toBe('jwt-A');

    falhar = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('a@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('retry que carrega outra conta atualiza a identidade da sessão (#294)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('token', 'jwt-A');
    let chamadasMe = 0;
    vi.mocked(globalThis.fetch).mockImplementation(async (url) => {
      if (String(url).includes('/api/me')) {
        chamadasMe += 1;
        if (chamadasMe === 1) throw new TypeError('Failed to fetch');
        return new Response(JSON.stringify(usuarioB), { status: 200 });
      }
      return new Response('null', { status: 200 });
    });

    render(
      <AuthProvider>
        <TelaComErro />
        <BotaoSair />
      </AuthProvider>,
    );
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    // Outra aba trocou para B; o `storage` ainda não chegou nesta.
    localStorage.setItem('token', 'jwt-B');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('b@example.com')).toBeInTheDocument();

    // A identidade da tela acompanhou B: o primeiro clique em Sair derruba o
    // token (sem isso, `logout` acharia que a sessão ainda é A e só recarregaria).
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(localStorage.getItem('token')).toBeNull());
  });

  it('retry que falha também atualiza a identidade da sessão (#294)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('token', 'jwt-A');
    vi.mocked(globalThis.fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    render(
      <AuthProvider>
        <TelaComErro />
        <BotaoSair />
      </AuthProvider>,
    );
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    // Outra aba trocou para B; o `storage` ainda não chegou e o retry falha.
    localStorage.setItem('token', 'jwt-B');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    // Mesmo falhando, a tela agora representa B: o primeiro Sair derruba o token.
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(localStorage.getItem('token')).toBeNull());
  });

  it('/me sem corpo (204) não vira logout: aviso e token preservado (#294)', async () => {
    const erroLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('token', 'jwt-A');
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 204 }));

    render(<AuthProvider><TelaComErro /></AuthProvider>);

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i);
    expect(localStorage.getItem('token')).toBe('jwt-A');
    expect(erroLog).toHaveBeenCalled();
  });

  it('resposta antiga de /me não derruba a consulta mais nova (#292)', async () => {
    localStorage.setItem('token', 'jwt-B');
    let rejeitarAntiga: ((erro: unknown) => void) | undefined;
    let chamadasMe = 0;
    vi.mocked(globalThis.fetch).mockImplementation(async (url) => {
      if (String(url).includes('/api/me')) {
        chamadasMe += 1;
        if (chamadasMe === 1) {
          return new Promise<Response>((_, reject) => {
            rejeitarAntiga = reject;
          });
        }
        return new Response(JSON.stringify(usuarioB), { status: 200 });
      }
      return new Response('null', { status: 200 });
    });

    render(
      <AuthProvider>
        <MostraUsuario />
      </AuthProvider>,
    );

    // Uma segunda consulta chega (evento) e resolve B enquanto a primeira
    // ainda está em voo.
    act(() => {
      window.dispatchEvent(new CustomEvent('noiteboa:session-change'));
    });
    expect(await screen.findByText('b@example.com')).toBeInTheDocument();

    // A primeira, mais lenta, falha depois: não pode zerar o usuário da nova.
    await act(async () => {
      rejeitarAntiga?.(new TypeError('Failed to fetch'));
    });
    expect(screen.getByText('b@example.com')).toBeInTheDocument();
  });

  it('login que responde depois da saída de outra aba não ressuscita a sessão (#310)', async () => {
    localStorage.setItem('token', 'jwt-antigo');
    let responderLogin: ((resposta: Response) => void) | undefined;
    vi.mocked(globalThis.fetch).mockImplementation(async (url) => {
      if (String(url).includes('/auth/login')) {
        return new Promise<Response>((resolve) => {
          responderLogin = resolve;
        });
      }
      return new Response(JSON.stringify(usuarioA), { status: 200 });
    });

    render(
      <AuthProvider>
        <TelaLogin />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(responderLogin).toBeDefined());

    // Outra aba saiu enquanto o login estava em voo: a geração da sessão mudou.
    await act(async () => {
      await clearSessionIfCurrent('jwt-antigo');
    });

    await act(async () => {
      responderLogin?.(
        new Response(JSON.stringify({ accessToken: 'jwt-novo' }), { status: 200 }),
      );
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/sessão mudou durante o login/i);
    expect(localStorage.getItem('token')).toBeNull();
  });
});
