import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMediaQuery } from '../hooks/useMediaQuery';
import NightBackground from '../components/NightBackground';
import BottomBar from './BottomBar';
import { primeiroNome, saudacao } from '../lib/saudacao';

/** Item do menu de navegação (desktop). */
interface MenuItem {
  path: string;
  label: string;
  exact: boolean;
}

/** Breakpoint único da navegação (issue #157): até 767px é celular. */
const CONSULTA_CELULAR = '(max-width: 767px)';

/** Rotas protegidas: só acessíveis com usuário logado */
const PROTECTED_ROUTES: string[] = ['/registrar', '/historico', '/dashboard', '/amigos', '/sons', '/configuracoes', '/hoje'];

/** Rotas de autenticação: só acessíveis SEM usuário logado */
const AUTH_ROUTES: string[] = ['/login', '/cadastro'];

/** Ordem dos itens no menu desktop (issue #209: Hoje é a primeira aba) */
const MENU_ITEMS_LOGGED_IN: MenuItem[] = [
  { path: '/hoje', label: 'Hoje', exact: false },
  { path: '/registrar', label: 'Registrar', exact: false },
  { path: '/historico', label: 'Histórico', exact: false },
  { path: '/dashboard', label: 'Dashboard', exact: false },
  { path: '/amigos', label: 'Amigos', exact: false },
  { path: '/sons', label: 'Sons', exact: false },
  { path: '/configuracoes', label: 'Configurações', exact: false },
];

export default function Layout() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  // Reativo a redimensionamento/rotação (media query do navegador), não um
  // `window.innerWidth` lido uma única vez no primeiro render.
  const isMobile = useMediaQuery(CONSULTA_CELULAR);

  // Redireciona rotas protegidas se não logado
  if (!loading && !user && PROTECTED_ROUTES.some((r) => location.pathname.startsWith(r))) {
    return <Navigate to="/login" replace />;
  }

  // Redireciona rotas de auth (login/cadastro) e a raiz quando já logado:
  // /hoje é a tela inicial do app (issue #210).
  if (!loading && user && (AUTH_ROUTES.includes(location.pathname) || location.pathname === '/')) {
    return <Navigate to="/hoje" replace />;
  }

  // Mostra esqueleto enquanto carrega a sessão
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
        <NightBackground />
        <header style={{ padding: '1rem', background: 'var(--color-noite)' }}>
          <img src="/logo-horizontal-dark.svg" alt="Noite Boa" style={{ height: '40px', width: 'auto' }} />
        </header>
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div role="status" aria-live="polite" style={{ color: 'var(--color-lavanda)' }}>Carregando…</div>
        </main>
        {isMobile && <BottomBar carregando />}
      </div>
    );
  }

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div style={{ fontFamily: 'var(--font-sans)', background: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column', color: 'var(--text-primary)' }}>
      <NightBackground />
      {/* Header desktop */}
      <header
        style={{
          padding: '0.75rem 1rem',
          background: 'var(--color-noite)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
        role="banner"
      >
        {isMobile && user ? (
          /* Cabeçalho do celular logado (issue #209): saudação + nome e a
             lua da marca. Sem links de navegação — eles ficam só na barra
             inferior (nada duplicado). */
          <>
            <div>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--color-lavanda)' }}>
                {saudacao(user.timezone ?? 'America/Sao_Paulo')},
              </p>
              <p style={{ margin: 0, fontSize: '26px', lineHeight: 1.15, fontWeight: 800, color: 'var(--color-luar)' }}>
                {primeiroNome(user.displayName ?? '')}
              </p>
            </div>
            <span
              aria-hidden="true"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'var(--surface)',
              }}
            >
              <img src="/mark-light.svg" alt="" width={34} height={34} style={{ display: 'block' }} />
            </span>
          </>
        ) : (
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }} aria-label="Noite Boa - Início">
            <img src="/logo-horizontal-dark.svg" alt="" style={{ height: '36px', width: 'auto' }} />
          </Link>
        )}

        {/* No celular logado o cabeçalho fica só com a saudação: a navegação vai
            para a barra inferior, sem duplicar. Visitante segue com
            Entrar/Cadastrar (não há barra inferior para ele). */}
        {(!isMobile || !user) && (
        <nav aria-label="Navegação principal" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {user ? (
            <>
              {MENU_ITEMS_LOGGED_IN.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={isActive(item.path) ? 'page' : undefined}
                  style={{
                    color: isActive(item.path) ? 'var(--color-luar)' : 'var(--color-lavanda)',
                    textDecoration: 'none',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    fontWeight: isActive(item.path) ? 700 : 400,
                    minHeight: '44px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    transition: 'color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,233,181,0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {item.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sair da conta"
                style={{
                  color: 'var(--color-ambar)',
                  background: 'none',
                  border: '1px solid var(--color-ambar)',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  fontWeight: 700,
                  minHeight: '44px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '15px',
                }}
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                aria-current={isActive('/login') ? 'page' : undefined}
                style={{
                  color: isActive('/login') ? 'var(--color-luar)' : 'var(--color-lavanda)',
                  textDecoration: 'none',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  fontWeight: isActive('/login') ? 700 : 400,
                  minHeight: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                Entrar
              </Link>
              <Link
                to="/cadastro"
                aria-current={isActive('/cadastro') ? 'page' : undefined}
                style={{
                  color: 'var(--color-noite)',
                  background: 'var(--color-ambar)',
                  textDecoration: 'none',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  fontWeight: 700,
                  minHeight: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                Cadastrar
              </Link>
            </>
          )}
        </nav>
        )}
      </header>

      {/* Bottom bar mobile (só para usuário logado) — issue #209 */}
      {isMobile && user && <BottomBar onLogout={handleLogout} />}

      <main style={{ flex: 1, padding: '1rem', paddingBottom: isMobile ? '100px' : '1rem' }}>
        <Outlet />
      </main>
    </div>
  );
}