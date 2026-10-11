import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { renderWithAuth } from '../test/test-utils';

describe('landing page', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('apresenta proposta, como funciona e chamada para cadastro', () => {
    renderWithAuth(<App />, { route: '/' });

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

  it('botão principal de cadastro leva para /cadastro', () => {
    renderWithAuth(<App />, { route: '/' });
    fireEvent.click(screen.getByRole('link', { name: 'Criar conta grátis' }));
    expect(window.location.pathname).toBe('/cadastro');
  });

  it('segunda chamada leva para /cadastro', () => {
    renderWithAuth(<App />, { route: '/' });
    fireEvent.click(screen.getByRole('link', { name: 'Criar conta' }));
    expect(window.location.pathname).toBe('/cadastro');
  });

  it('link "Já tenho conta" leva para /login', () => {
    renderWithAuth(<App />, { route: '/' });
    fireEvent.click(screen.getByRole('link', { name: 'Já tenho conta' }));
    expect(window.location.pathname).toBe('/login');
  });

  it('nome da marca aparece como texto e a marca é decorativa', () => {
    const { container } = renderWithAuth(<App />, { route: '/' });

    expect(screen.getByText('Noite Boa', { selector: 'span' })).toBeInTheDocument();

    const img = container.querySelector('img[src="/mark-light.svg"]');
    expect(img).not.toBeNull();
    // imagem decorativa: o nome já vem do texto ao lado (alt vazio)
    expect(img).toHaveAttribute('alt', '');
  });
});
