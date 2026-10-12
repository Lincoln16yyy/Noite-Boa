import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import Cadastro from './Cadastro';

describe('tela de Cadastro', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const renderCadastro = () => {
    return render(
      <MemoryRouter initialEntries={['/cadastro']}>
        <ThemeProvider>
          <AuthProvider>
            <Routes>
              <Route path="/cadastro" element={<Cadastro />} />
              <Route path="/login" element={<h1>Login</h1>} />
            </Routes>
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );
  };

  it('cria a conta e leva para o login', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('/me')) return new Response('null', { status: 200 });
      return new Response(JSON.stringify({ id: '1', email: 'ana@exemplo.com' }), { status: 201 });
    });

    renderCadastro();

    fireEvent.change(screen.getByPlaceholderText('Nome'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByPlaceholderText('E-mail'), {
      target: { value: 'ana@exemplo.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Senha (mín. 8 caracteres)'), {
      target: { value: 'senha1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    // Navega para a tela de login (MemoryRouter)
    expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/register'),
      expect.objectContaining({
        body: JSON.stringify({
          displayName: 'Ana',
          email: 'ana@exemplo.com',
          password: 'senha1234',
        }),
      }),
    );
  });

  it('valida a senha antes de chamar a API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      // Sessão inicial do AuthProvider; o cadastro não deve chegar aqui
      if (String(url).includes('/me')) return new Response('null', { status: 200 });
      return new Response('{}', { status: 201 });
    });

    renderCadastro();

    fireEvent.change(screen.getByPlaceholderText('Nome'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByPlaceholderText('E-mail'), {
      target: { value: 'ana@exemplo.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Senha (mín. 8 caracteres)'), {
      target: { value: '123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('pelo menos 8 caracteres');
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/auth/register'),
      expect.anything(),
    );
  });

  it('exibe o link da política de privacidade', () => {
    renderCadastro();

    const link = screen.getByRole('link', { name: /política de privacidade/i });
    expect(link).toHaveAttribute('href', '/privacidade');
  });

  it('mostra o erro de e-mail duplicado vindo da API', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('/auth/register')) {
        return new Response(JSON.stringify({ detail: 'Já existe uma conta com este e-mail.' }), { status: 409 });
      }
      return new Response('null', { status: 200 });
    });

    renderCadastro();

    fireEvent.change(screen.getByPlaceholderText('Nome'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByPlaceholderText('E-mail'), {
      target: { value: 'ana@exemplo.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Senha (mín. 8 caracteres)'), {
      target: { value: 'senha1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Já existe uma conta');
    // O formulário permanece em /cadastro após erro de validação
    expect(screen.getByPlaceholderText('Nome')).toBeInTheDocument();
  });
});
