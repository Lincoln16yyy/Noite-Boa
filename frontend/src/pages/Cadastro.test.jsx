import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

describe('tela de Cadastro', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('cria a conta e leva para o login', async () => {
    window.history.pushState({}, '', '/cadastro');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: '1', email: 'ana@exemplo.com' }), { status: 201 }),
    );

    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('Nome'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByPlaceholderText('E-mail'), {
      target: { value: 'ana@exemplo.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Senha (mín. 8 caracteres)'), {
      target: { value: 'senha1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() => expect(window.location.pathname).toBe('/login'));
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
    window.history.pushState({}, '', '/cadastro');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 201 }));

    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('Nome'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByPlaceholderText('E-mail'), {
      target: { value: 'ana@exemplo.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Senha (mín. 8 caracteres)'), {
      target: { value: '123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('pelo menos 8 caracteres');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exibe o link da política de privacidade', () => {
    window.history.pushState({}, '', '/cadastro');
    render(<App />);

    const link = screen.getByRole('link', { name: /política de privacidade/i });
    expect(link).toHaveAttribute('href', '/privacidade');
  });

  it('mostra o erro de e-mail duplicado vindo da API', async () => {
    window.history.pushState({}, '', '/cadastro');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Já existe uma conta com este e-mail.' }), { status: 409 }),
    );

    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('Nome'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByPlaceholderText('E-mail'), {
      target: { value: 'ana@exemplo.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Senha (mín. 8 caracteres)'), {
      target: { value: 'senha1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Já existe uma conta');
    expect(window.location.pathname).toBe('/cadastro');
  });
});
