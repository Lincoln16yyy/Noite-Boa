import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderWithAuth } from '../test/test-utils';

describe('Página de Política de Privacidade', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function openScreen(route = '/privacidade') {
    return renderWithAuth(null, { route });
  }

  it('abre direto pela URL, sem exigir login', () => {
    openScreen();

    expect(
      screen.getByRole('heading', { level: 1, name: /política de privacidade/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /quais dados coletamos/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /como excluir a conta/i })).toBeInTheDocument();
    // nenhuma redirecionamento para login
    expect(window.location.pathname).toBe('/privacidade');
  });

  it('informa a data de atualização e os serviços externos', () => {
    openScreen();
    expect(screen.getAllByText(/última atualização/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Vercel/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Render/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Neon/).length).toBeGreaterThan(0);
  });

  it('mostra o responsável e o canal de contato de privacidade confirmados', () => {
    openScreen();
    // responsável: projeto pessoal, sem empresa
    expect(screen.getByText(/projeto pessoal/i)).toBeInTheDocument();
    // canal de contato é link de e-mail nos dois pontos (seções 1 e 10)
    const emails = screen.getAllByRole('link', { name: 'lincolngustavo819@gmail.com' });
    expect(emails.length).toBeGreaterThanOrEqual(2);
    for (const link of emails) {
      expect(link).toHaveAttribute('href', 'mailto:lincolngustavo819@gmail.com');
    }
    // nenhum marcador de pendência sobrou na página
    expect(screen.queryByText(/pendência desta edição/i)).not.toBeInTheDocument();
  });

  it('não promete aceitação automática de novas versões da política', () => {
    openScreen();
    expect(
      screen.queryByText(/continuar usando o aplicativo.*aceita a versão nova/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /alterações nesta política/i })).toBeInTheDocument();
  });

  it('chega na página pelo link do cadastro', () => {
    const { screen } = renderWithAuth(null, { route: '/cadastro' });
    fireEvent.click(screen.getByRole('link', { name: /política de privacidade/i }));
    expect(window.location.pathname).toBe('/privacidade');
    expect(
      screen.getByRole('heading', { level: 1, name: /política de privacidade/i }),
    ).toBeInTheDocument();
  });
});
