import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

test('renders layout with navigation', async () => {
  // Sessão sem usuário logado: /me retorna corpo nulo
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('null', { status: 200 }));

  render(
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>,
  );

  // "Noite Boa" também aparece na landing; o link do nav continua único
  expect(await screen.findByRole('link', { name: /Noite Boa/ })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Entrar' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Cadastrar' })).toBeInTheDocument();
});
