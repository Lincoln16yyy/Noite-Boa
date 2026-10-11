import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderWithAuth, mockMe } from '../test/test-utils';

describe('Página de Política de Privacidade', () => {
  beforeEach(() => {
    localStorage.clear();
    mockMe(null); // /me retorna 404 -> usuário não logado
  });

  function openScreen(route = '/privacidade') {
    return renderWithAuth(null, { route });
  }

  it('abre direto pela URL, sem exigir login', () => {
    return openScreen().then(() => waitFor(() => screen.getByRole('heading', { level: 1, name: /política de privacidade/i }))).then(() => {
      expect(screen.getByRole('heading', { level: 1, name: /política de privacidade/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /quais dados coletamos/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /como excluir a conta/i })).toBeInTheDocument();
      expect(window.location.pathname).toBe('/privacidade');
    });
  });

  it('informa a data de atualização e os serviços externos', () => {
    return openScreen().then(() => waitFor(() => screen.getByRole('heading', { level: 1, name: /política de privacidade/i }))).then(() => {
      expect(screen.getAllByText(/última atualização/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Vercel/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Render/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Neon/).length).toBeGreaterThan(0);
    });
  });

  it('mostra o responsável e o canal de contato de privacidade confirmados', () => {
    return openScreen().then(() => waitFor(() => screen.getByRole('heading', { level: 1, name: /política de privacidade/i }))).then(() => {
      expect(screen.getByText(/projeto pessoal/i)).toBeInTheDocument();
      const emails = screen.getAllByRole('link', { name: 'lincolngustavo819@gmail.com' });
      expect(emails.length).toBeGreaterThanOrEqual(2);
      for (const link of emails) {
        expect(link).toHaveAttribute('href', 'mailto:lincolngustavo819@gmail.com');
      }
      expect(screen.queryByText(/pendência desta edição/i)).not.toBeInTheDocument();
    });
  });

  it('não promete aceitação automática de novas versões da política', () => {
    return openScreen().then(() => waitFor(() => screen.getByRole('heading', { level: 1, name: /política de privacidade/i }))).then(() => {
      expect(screen.queryByText(/continuar usando o aplicativo.*aceita a versão nova/i)).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /alterações nesta política/i })).toBeInTheDocument();
    });
  });

  it('chega na página pelo link do cadastro', () => {
    const { screen } = renderWithAuth(null, { route: '/cadastro' });
    return waitFor(() => screen.getByRole('link', { name: /política de privacidade/i })).then(() => {
      fireEvent.click(screen.getByRole('link', { name: /política de privacidade/i }));
      return waitFor(() => expect(window.location.pathname).toBe('/privacidade'));
    }).then(() => waitFor(() => screen.getByRole('heading', { level: 1, name: /política de privacidade/i })));
  });
});