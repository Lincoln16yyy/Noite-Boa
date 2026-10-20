import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { api } from '../api/client';
import Login from './Login';

describe('tela de Login', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('guarda o token e chama api.post no login com sucesso', async () => {
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ accessToken: 'jwt-123' });

    render(<Login />, { wrapper: ({ children }) => (
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    ) });

    fireEvent.change(screen.getByPlaceholderText('E-mail'), {
      target: { value: 'ana@exemplo.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Senha'), {
      target: { value: 'senha123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(postSpy).toHaveBeenCalledWith('/auth/login', {
      email: 'ana@exemplo.com',
      password: 'senha123',
    }));
    expect(localStorage.getItem('token')).toBe('jwt-123');
  });

  it('mostra a mensagem da API quando as credenciais são inválidas', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(new Error('Credenciais inválidas'));

    render(<Login />, { wrapper: ({ children }) => (
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    ) });

    fireEvent.change(screen.getByPlaceholderText('E-mail'), {
      target: { value: 'ana@exemplo.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Senha'), {
      target: { value: 'senhaerrada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciais inválidas');
    expect(screen.getByPlaceholderText('E-mail')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('envia o login uma única vez em duplo clique (#274)', async () => {
    let liberar: ((valor: { accessToken: string }) => void) | undefined;
    const postSpy = vi.spyOn(api, 'post').mockImplementation(
      () => new Promise((resolve) => { liberar = resolve; }),
    );

    render(<Login />, { wrapper: ({ children }) => (
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    ) });

    fireEvent.change(screen.getByPlaceholderText('E-mail'), {
      target: { value: 'ana@exemplo.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Senha'), {
      target: { value: 'senha123' },
    });
    const botao = screen.getByRole('button', { name: 'Entrar' });

    // dois cliques no mesmo batch do React: o estado ainda é o antigo,
    // então só um cadeado por ref impede a segunda requisição
    await act(async () => {
      // dispatchEvent (em vez de fireEvent) não abre um act por clique: os dois
      // handlers rodam antes do re-render, então o estado ainda é o antigo e só
      // um cadeado por ref impede a segunda requisição (review do PR #291).
      botao.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      botao.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(botao).toBeDisabled();
    expect(postSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      liberar?.({ accessToken: 'jwt-123' });
    });
    await waitFor(() => expect(localStorage.getItem('token')).toBe('jwt-123'));
  });

  it('avisa que a conta foi criada quando vem do cadastro', () => {
    render(<Login />, { wrapper: ({ children }) => (
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { created: true } }]}>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    ) });

    expect(screen.getByRole('status')).toHaveTextContent('Conta criada! Faça login.');
  });
});
