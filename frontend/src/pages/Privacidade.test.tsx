import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import Cadastro from './Cadastro';
import Privacidade from './Privacidade';
import { renderWithAuth, mockMe } from '../test/test-utils';

/**
 * Renderiza as rotas públicas com providers (AuthContext, ThemeContext) e
 * rota em memória, para provar que a política abre direto pela URL.
 */
function renderPrivacidade(route = '/privacidade') {
  return renderWithAuth(
    <Routes>
      <Route path="/cadastro" element={<Cadastro />} />
      <Route path="/privacidade" element={<Privacidade />} />
    </Routes>,
    { route },
  );
}

describe('Página de Política de Privacidade', () => {
  beforeEach(() => {
    localStorage.clear();
    mockMe(null); // /me retorna null -> usuário não logado
  });

  it('abre direto pela URL, sem exigir login', async () => {
    renderPrivacidade();
    await screen.findByRole('heading', { level: 1, name: /política de privacidade/i });

    expect(
      screen.getByRole('heading', { level: 1, name: /política de privacidade/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /quais dados coletamos/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /como excluir a conta/i })).toBeInTheDocument();
  });

  it('informa a data de atualização e os serviços externos', async () => {
    renderPrivacidade();
    await screen.findByRole('heading', { level: 1, name: /política de privacidade/i });
    expect(screen.getAllByText(/última atualização/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Vercel/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Render/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Neon/).length).toBeGreaterThan(0);
  });

  it('mostra o responsável e o canal de contato de privacidade confirmados', async () => {
    renderPrivacidade();
    await screen.findByRole('heading', { level: 1, name: /política de privacidade/i });
    expect(screen.getByText(/projeto pessoal/i)).toBeInTheDocument();
    const emails = screen.getAllByRole('link', { name: 'lincolngustavo819@gmail.com' });
    expect(emails.length).toBeGreaterThanOrEqual(2);
    for (const link of emails) {
      expect(link).toHaveAttribute('href', 'mailto:lincolngustavo819@gmail.com');
    }
    expect(screen.queryByText(/pendência desta edição/i)).not.toBeInTheDocument();
  });

  it('não promete aceitação automática de novas versões da política', async () => {
    renderPrivacidade();
    await screen.findByRole('heading', { level: 1, name: /política de privacidade/i });
    expect(screen.queryByText(/continuar usando o aplicativo.*aceita a versão nova/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /alterações nesta política/i })).toBeInTheDocument();
  });

  it('chega na página pelo link do cadastro', async () => {
    renderPrivacidade('/cadastro');
    fireEvent.click(await screen.findByRole('link', { name: /política de privacidade/i }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /política de privacidade/i }),
    ).toBeInTheDocument();
  });
});
