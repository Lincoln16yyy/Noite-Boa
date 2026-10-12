import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('avisa que a conta foi criada quando vem do cadastro', () => {
    render(<Login />, { wrapper: ({ children }) => (
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { created: true } }]}>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    ) });

    expect(screen.getByRole('status')).toHaveTextContent('Conta criada! Faça login.');
  });
});
