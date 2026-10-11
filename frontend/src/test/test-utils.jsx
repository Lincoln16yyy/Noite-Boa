import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { vi } from 'vitest';

/**
 * Wrapper que provê AuthContext e Router para testes.
 * O `user` mockado permite simular estados logado/deslogado.
 */
export function renderWithAuth(ui, { user = null, route = '/', ...options } = {}) {
  // Mock do localStorage para o token
  if (user) {
    localStorage.setItem('token', 'mock-token');
  } else {
    localStorage.removeItem('token');
  }

  // Mock do api.get('/me') se necessário
  const originalFetch = globalThis.fetch;
  if (user) {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url && String(url).includes('/me')) {
        return new Response(JSON.stringify(user), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return originalFetch(url);
    });
  }

  const Wrapper = ({ children }) => (
    <BrowserRouter initialEntries={[route]}>
      <AuthProvider>{children}</AuthProvider>
    </BrowserRouter>
  );

  const result = render(ui, { wrapper: Wrapper, ...options });

  // Cleanup do mock
  if (user) {
    vi.restoreAllMocks();
  }

  return result;
}

// Re-export para conveniência
export { screen, fireEvent, waitFor, act } from '@testing-library/react';