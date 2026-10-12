import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import Home from './Home';
import { renderWithAuth, mockMe } from '../test/test-utils';

/**
 * Renderiza a landing page com providers (AuthContext, ThemeContext) e rota
 * em memória. As rotas de destino viram marcadores simples para provar a
 * navegação sem depender do window.location.
 */
function renderLanding() {
  return renderWithAuth(
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/cadastro" element={<h1>Cadastro</h1>} />
      <Route path="/login" element={<h1>Login</h1>} />
    </Routes>,
    { route: '/' },
  );
}

describe('landing page', () => {
  beforeEach(() => {
    localStorage.clear();
    mockMe(null); // /me retorna null -> usuário não logado
  });

  it('apresenta proposta, como funciona e chamada para cadastro', async () => {
    renderLanding();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Durma melhor, no seu ritmo.' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/diário de sono simples/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Como funciona' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Registre sua noite')).toBeInTheDocument();
    expect(screen.getByText('Entenda seu padrão')).toBeInTheDocument();
    expect(screen.getByText('Ajuste sua meta')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Pronto para dormir melhor?' }),
    ).toBeInTheDocument();
  });

  it('botão principal de cadastro leva para /cadastro', async () => {
    renderLanding();
    fireEvent.click(await screen.findByRole('link', { name: 'Criar conta grátis' }));
    expect(await screen.findByRole('heading', { name: 'Cadastro' })).toBeInTheDocument();
  });

  it('segunda chamada leva para /cadastro', async () => {
    renderLanding();
    fireEvent.click(await screen.findByRole('link', { name: 'Criar conta' }));
    expect(await screen.findByRole('heading', { name: 'Cadastro' })).toBeInTheDocument();
  });

  it('link "Já tenho conta" leva para /login', async () => {
    renderLanding();
    fireEvent.click(await screen.findByRole('link', { name: 'Já tenho conta' }));
    expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
  });

  it('nome da marca aparece como texto e a marca é decorativa', async () => {
    const { container } = renderLanding();
    expect(await screen.findByText('Noite Boa', { selector: 'span' })).toBeInTheDocument();
    const img = container.querySelector('img[src="/mark-light.svg"]');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('alt', '');
  });
});
