import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { renderWithAuth, mockMe } from '../test/test-utils';

describe('landing page', () => {
  beforeEach(() => {
    localStorage.clear();
    mockMe(null); // /me retorna 404 -> usuário não logado
  });

  it('apresenta proposta, como funciona e chamada para cadastro', async () => {
    renderWithAuth(<App />, { route: '/' });
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Durma melhor, no seu ritmo.' }));

    // proposta
    expect(
      screen.getByRole('heading', { level: 1, name: 'Durma melhor, no seu ritmo.' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/diário de sono simples/i)).toBeInTheDocument();

    // como funciona: 3 passos
    expect(screen.getByRole('heading', { level: 2, name: 'Como funciona' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Registre sua noite')).toBeInTheDocument();
    expect(screen.getByText('Entenda seu padrão')).toBeInTheDocument();
    expect(screen.getByText('Ajuste sua meta')).toBeInTheDocument();

    // chamada para cadastro
    expect(
      screen.getByRole('heading', { level: 2, name: 'Pronto para dormir melhor?' }),
    ).toBeInTheDocument();
  });

  it('botão principal de cadastro leva para /cadastro', async () => {
    renderWithAuth(<App />, { route: '/' });
    await waitFor(() => screen.getByRole('link', { name: 'Criar conta grátis' }));
    fireEvent.click(screen.getByRole('link', { name: 'Criar conta grátis' }));
    await waitFor(() => expect(window.location.pathname).toBe('/cadastro'));
  });

  it('segunda chamada leva para /cadastro', async () => {
    renderWithAuth(<App />, { route: '/' });
    await waitFor(() => screen.getByRole('link', { name: 'Criar conta' }));
    fireEvent.click(screen.getByRole('link', { name: 'Criar conta' }));
    await waitFor(() => expect(window.location.pathname).toBe('/cadastro'));
  });

  it('link "Já tenho conta" leva para /login', async () => {
    renderWithAuth(<App />, { route: '/' });
    await waitFor(() => screen.getByRole('link', { name: 'Já tenho conta' }));
    fireEvent.click(screen.getByRole('link', { name: 'Já tenho conta' }));
    await waitFor(() => expect(window.location.pathname).toBe('/login'));
  });

  it('nome da marca aparece como texto e a marca é decorativa', async () => {
    const { container } = renderWithAuth(<App />, { route: '/' });
    await waitFor(() => screen.getByText('Noite Boa', { selector: 'span' }));

    expect(screen.getByText('Noite Boa', { selector: 'span' })).toBeInTheDocument();

    const img = container.querySelector('img[src="/mark-light.svg"]');
    expect(img).not.toBeNull();
    // imagem decorativa: o nome já vem do texto ao lado (alt vazio)
    expect(img).toHaveAttribute('alt', '');
  });
});