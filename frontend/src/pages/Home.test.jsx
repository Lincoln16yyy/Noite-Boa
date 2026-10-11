import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { renderWithAuth, mockMe } from '../test/test-utils';

describe('landing page', () => {
  beforeEach(() => {
    localStorage.clear();
    mockMe(null); // /me retorna 404 -> usuário não logado
  });

  it.skip('apresenta proposta, como funciona e chamada para cadastro', () => {
    return renderWithAuth(<App />, { route: '/' }).then(() => waitFor(() => screen.getByRole('heading', { level: 1, name: 'Durma melhor, no seu ritmo.' }))).then(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Durma melhor, no seu ritmo.' })).toBeInTheDocument();
      expect(screen.getByText(/diário de sono simples/i)).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Como funciona' })).toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
      expect(screen.getByText('Registre sua noite')).toBeInTheDocument();
      expect(screen.getByText('Entenda seu padrão')).toBeInTheDocument();
      expect(screen.getByText('Ajuste sua meta')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Pronto para dormir melhor?' })).toBeInTheDocument();
    });
  });

  it.skip('botão principal de cadastro leva para /cadastro', () => {
    return renderWithAuth(<App />, { route: '/' }).then(() => waitFor(() => screen.getByRole('link', { name: 'Criar conta grátis' }))).then(() => {
      fireEvent.click(screen.getByRole('link', { name: 'Criar conta grátis' }));
      return waitFor(() => expect(window.location.pathname).toBe('/cadastro'));
    });
  });

  it.skip('segunda chamada leva para /cadastro', () => {
    return renderWithAuth(<App />, { route: '/' }).then(() => waitFor(() => screen.getByRole('link', { name: 'Criar conta' }))).then(() => {
      fireEvent.click(screen.getByRole('link', { name: 'Criar conta' }));
      return waitFor(() => expect(window.location.pathname).toBe('/cadastro'));
    });
  });

  it.skip('link "Já tenho conta" leva para /login', () => {
    return renderWithAuth(<App />, { route: '/' }).then(() => waitFor(() => screen.getByRole('link', { name: 'Já tenho conta' }))).then(() => {
      fireEvent.click(screen.getByRole('link', { name: 'Já tenho conta' }));
      return waitFor(() => expect(window.location.pathname).toBe('/login'));
    });
  });

  it.skip('nome da marca aparece como texto e a marca é decorativa', () => {
    return renderWithAuth(<App />, { route: '/' }).then(() => waitFor(() => screen.getByText('Noite Boa', { selector: 'span' }))).then(({ container }) => {
      expect(screen.getByText('Noite Boa', { selector: 'span' })).toBeInTheDocument();
      const img = container.querySelector('img[src="/mark-light.svg"]');
      expect(img).not.toBeNull();
      expect(img).toHaveAttribute('alt', '');
    });
  });
});