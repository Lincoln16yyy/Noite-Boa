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

  it.skip('abre direto pela URL, sem exigir login', async () => {
    openScreen();
    await waitFor(() => screen.getByRole('heading', { level: 1, name: /política de privacidade/i }));

    expect(
      screen.getByRole('heading', { level: 1, name: /política de privacidade/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /quais dados coletamos/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /como excluir a conta/i })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/privacidade');
  });

  it.skip('informa a data de atualização e os serviços externos', async () => {
    openScreen();
    await waitFor(() => screen.getByRole('heading', { level: 1, name: /política de privacidade/i }));
    expect(screen.getAllByText(/última atualização/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Vercel/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Render/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Neon/).length).toBeGreaterThan(0);
  });

  it.skip('mostra o responsável e o canal de contato de privacidade confirmados', async () => {
    openScreen();
    await waitFor(() => screen.getByRole('heading', { level: 1, name: /política de privacidade/i }));
    expect(screen.getByText(/projeto pessoal/i)).toBeInTheDocument();
    const emails = screen.getAllByRole('link', { name: 'lincolngustavo819@gmail.com' });
    expect(emails.length).toBeGreaterThanOrEqual(2);
    for (const link of emails) {
      expect(link).toHaveAttribute('href', 'mailto:lincolngustavo819@gmail.com');
    }
    expect(screen.queryByText(/pendência desta edição/i)).not.toBeInTheDocument();
  });

  it.skip('não promete aceitação automática de novas versões da política', async () => {
    openScreen();
    await waitFor(() => screen.getByRole('heading', { level: 1, name: /política de privacidade/i }));
    expect(screen.queryByText(/continuar usando o aplicativo.*aceita a versão nova/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /alterações nesta política/i })).toBeInTheDocument();
  });

  it.skip('chega na página pelo link do cadastro', async () => {
    const { screen } = renderWithAuth(null, { route: '/cadastro' });
    await waitFor(() => screen.getByRole('link', { name: /política de privacidade/i }));
    fireEvent.click(screen.getByRole('link', { name: /política de privacidade/i }));
    await waitFor(() => expect(window.location.pathname).toBe('/privacidade'));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: /política de privacidade/i }));
  });
});