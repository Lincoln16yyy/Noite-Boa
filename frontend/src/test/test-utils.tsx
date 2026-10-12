import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import type { Theme } from '../context/ThemeContext';
import { vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import type { User } from '../api/types';

/**
 * Mocka o endpoint /me para retornar o usuário especificado.
 * Deve ser chamado nos testes que precisam de usuário logado, ANTES de renderWithAuth.
 */
export function mockMe(user: User | null) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    if (url && String(url).includes('/me')) {
      return new Response(JSON.stringify(user), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 404 });
  });
}

/** Opções de `renderWithAuth`. */
export interface RenderWithAuthOptions extends Omit<RenderOptions, 'wrapper'> {
  user?: User | null;
  route?: string;
  theme?: Theme;
}

/**
 * Wrapper que provê AuthContext, ThemeContext e Router (MemoryRouter) para testes.
 * O `user` mockado permite simular estados logado/deslogado.
 * Usa MemoryRouter com initialEntries para navegação em testes.
 */
export function renderWithAuth(
  ui: ReactElement,
  { user = null, route = '/', theme = 'auto', ...options }: RenderWithAuthOptions = {},
) {
  // Mock do localStorage para o token
  if (user) {
    localStorage.setItem('token', 'mock-token');
  } else {
    localStorage.removeItem('token');
  }

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[route]}>
      <ThemeProvider initialTheme={theme}>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </MemoryRouter>
  );

  return render(ui, { wrapper: Wrapper, ...options });
}

/**
 * Mocka o tema para testes.
 */
export function mockTheme(theme: Theme) {
  // O ThemeProvider lê do localStorage, então mockamos isso
  localStorage.setItem('noiteboa.theme', theme);
}

// Re-export para conveniência
export { screen, fireEvent, waitFor, act } from '@testing-library/react';
