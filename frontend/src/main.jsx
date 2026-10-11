import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { iniciarLembrete } from './lib/reminder';
import { AuthProvider } from './context/AuthContext';
import './styles/tokens.css';
import './styles/base.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);

// Lembrete de dormir (issue #38): melhor esforço, só com o app aberto.
// Só agenda se o usuário já tiver ativado e permitido a notificação.
window.addEventListener('load', () => {
  iniciarLembrete();
});

// PWA (issue #37): registra o service worker só no build de produção,
// para não interferir no hot reload do desenvolvimento.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline/instalação falhou: o app segue funcionando sem cache */
    });
  });
}
