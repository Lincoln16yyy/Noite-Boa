import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';

/** Mocka o /me do AuthProvider: com usuário logado ou sem sessão (401). */
function mockFetchUser(user: unknown) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    if (String(url).includes('/me')) {
      if (!user) {
        return new Response(JSON.stringify({ title: 'Unauthorized' }), { status: 401 });
      }
      return new Response(JSON.stringify(user), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 404 });
  });
}

function renderApp() {
  return render(
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>,
  );
}

describe('rotas protegidas', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/dashboard');
  });

  it('redireciona para /login quando não há sessão', async () => {
    mockFetchUser(null);
    renderApp();
    await screen.findByRole('heading', { name: 'Login' });
    expect(window.location.pathname).toBe('/login');
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('libera a rota quando há token salvo', async () => {
    localStorage.setItem('token', 'jwt-123');
    mockFetchUser({ id: 'u1', email: 'ana@exemplo.com', displayName: 'Ana', timezone: 'America/Sao_Paulo' });
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/dashboard');
  });

  it('protege também histórico, registro e configurações', async () => {
    const paths = ['/registrar', '/historico', '/configuracoes'];
    for (const path of paths) {
      localStorage.clear();
      window.history.pushState({}, '', path);
      mockFetchUser(null);
      const { unmount } = renderApp();
      await screen.findByRole('heading', { name: 'Login' });
      expect(window.location.pathname).toBe('/login');
      unmount();
    }
  });
});
