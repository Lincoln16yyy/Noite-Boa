import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import './styles/tokens.css';
import './styles/base.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);

// O lembrete de dormir (issue #38) é armado no Layout, quando o `/me` já
// trouxe o fuso do perfil (#278).

// PWA (issue #37): registra o service worker só no build de produção,
// para não interferir no hot reload do desenvolvimento.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline/instalação falhou: o app segue funcionando sem cache */
    });
  });
}
