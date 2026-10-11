import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

/** Rotas protegidas: só acessíveis com usuário logado */
const PROTECTED_ROUTES = ['/registrar', '/historico', '/dashboard', '/amigos', '/sons', '/configuracoes'];

/** Rotas de autenticação: só acessíveis SEM usuário logado */
const AUTH_ROUTES = ['/login', '/cadastro'];

/** Ordem dos itens no menu desktop / aba "Mais" mobile */
const MENU_ITEMS_LOGGED_IN = [
  { path: '/registrar', label: 'Registrar', exact: false },
  { path: '/historico', label: 'Histórico', exact: false },
  { path: '/dashboard', label: 'Dashboard', exact: false },
  { path: '/amigos', label: 'Amigos', exact: false },
  { path: '/sons', label: 'Sons', exact: false },
  { path: '/configuracoes', label: 'Configurações', exact: false },
];

/** 5 abas principais do bottom bar (mobile) */
const BOTTOM_TABS = [
  { path: '/registrar', label: 'Registrar', icon: '📝' },
  { path: '/historico', label: 'Histórico', icon: '📋' },
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/amigos', label: 'Amigos', icon: '👥' },
];

const MORE_ITEMS = [
  { path: '/sons', label: 'Sons' },
  { path: '/configuracoes', label: 'Configurações' },
  { path: '/logout', label: 'Sair', action: true },
];

export default function Layout() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const [moreOpen, setMoreOpen] = useState(false);

  // Redireciona rotas protegidas se não logado
  if (!loading && !user && PROTECTED_ROUTES.some((r) => location.pathname.startsWith(r))) {
    return <Navigate to="/login" replace />;
  }

  // Redireciona rotas de auth se já logado
  if (!loading && user && AUTH_ROUTES.includes(location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Mostra esqueleto enquanto carrega a sessão
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F5F3FF', display: 'flex', flexDirection: 'column' }}>
        <header style={{ padding: '1rem', background: '#15142E' }}>
          <img src="/logo-horizontal-light.svg" alt="Noite Boa" style={{ height: '40px', width: 'auto' }} />
        </header>
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div role="status" aria-live="polite" style={{ color: '#B9B6FF' }}>Carregando…</div>
        </main>
        {isMobile && (
          <nav
            aria-label="Navegação principal"
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: '#15142E',
              borderTop: '1px solid #3F3CBB',
              display: 'flex',
              justifyContent: 'space-around',
              padding: '0.5rem 0',
              zIndex: 100,
            }}
          >
            {BOTTOM_TABS.map((tab) => (
              <button key={tab.path} disabled style={{ opacity: 0.5, cursor: 'not-allowed', background: 'none', border: 'none', color: '#B9B6FF', padding: '0.5rem', minHeight: '44px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem', fontSize: '11px' }}>
                <span aria-hidden="true">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
            <button disabled style={{ opacity: 0.5, cursor: 'not-allowed', background: 'none', border: 'none', color: '#B9B6FF', padding: '0.5rem', minHeight: '44px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem', fontSize: '11px' }}>
              <span aria-hidden="true">⋯</span>
              <span>Mais</span>
            </button>
          </nav>
        )}
      </div>
    );
  }

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    logout();
    setMoreOpen(false);
  };

  return (
    <div style={{ fontFamily: 'var(--font-sans)', background: 'var(--color-nevoa)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header desktop */}
      <header
        style={{
          padding: '0.75rem 1rem',
          background: '#15142E',
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
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }} aria-label="Noite Boa - Início">
          <img src="/logo-horizontal-light.svg" alt="" style={{ height: '36px', width: 'auto' }} />
        </Link>

        <nav aria-label="Navegação principal" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {user ? (
            <>
              {MENU_ITEMS_LOGGED_IN.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={isActive(item.path) ? 'page' : undefined}
                  style={{
                    color: isActive(item.path) ? '#FFE9B5' : '#B9B6FF',
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
                  color: '#FFB347',
                  background: 'none',
                  border: '1px solid #FFB347',
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
                  color: isActive('/login') ? '#FFE9B5' : '#B9B6FF',
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
                  color: '#15142E',
                  background: '#FFE9B5',
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
      </header>

      {/* Bottom bar mobile */}
      {isMobile && (
        <nav
          aria-label="Navegação principal"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: '#15142E',
            borderTop: '1px solid #3F3CBB',
            display: 'flex',
            justifyContent: 'space-around',
            padding: '0.4rem 0',
            zIndex: 100,
          }}
        >
          {BOTTOM_TABS.map((tab) => (
            <Link
              key={tab.path}
              to={tab.path}
              aria-current={isActive(tab.path) ? 'page' : undefined}
              style={{
                textDecoration: 'none',
                color: isActive(tab.path) ? '#FFE9B5' : '#B9B6FF',
                padding: '0.4rem 0.5rem',
                minHeight: '44px',
                minWidth: '44px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.15rem',
                fontSize: '11px',
                fontWeight: isActive(tab.path) ? 700 : 400,
              }}
            >
              <span aria-hidden="true" style={{ fontSize: '20px', lineHeight: 1 }}>{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          ))}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setMoreOpen(!moreOpen)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              aria-label={moreOpen ? 'Fechar menu' : 'Mais opções'}
              style={{
                background: 'none',
                border: 'none',
                color: '#B9B6FF',
                padding: '0.4rem 0.5rem',
                minHeight: '44px',
                minWidth: '44px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.15rem',
                fontSize: '11px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <span aria-hidden="true" style={{ fontSize: '24px', lineHeight: 1 }}>⋯</span>
              <span>Mais</span>
            </button>
            {moreOpen && (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  right: 0,
                  background: '#15142E',
                  border: '1px solid #3F3CBB',
                  borderRadius: '12px 12px 0 0',
                  boxShadow: '0 -4px 24px rgba(21,20,46,0.3)',
                  padding: '0.5rem',
                  minWidth: '180px',
                  zIndex: 200,
                  animation: 'slideUp 0.15s ease-out',
                }}
              >
                <style jsx>{`
                  @keyframes slideUp {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                  }
                `}</style>
                {MORE_ITEMS.map((item) =>
                  item.action ? (
                    <button
                      key={item.path}
                      type="button"
                      role="menuitem"
                      onClick={item.path === '/logout' ? handleLogout : undefined}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.75rem 1rem',
                        background: 'none',
                        border: 'none',
                        color: item.path === '/logout' ? '#FFB347' : '#FFE9B5',
                        fontSize: '15px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        borderRadius: '8px',
                      }}
                    >
                      {item.label}
                    </button>
                  ) : (
                    <Link
                      key={item.path}
                      to={item.path}
                      role="menuitem"
                      onClick={() => setMoreOpen(false)}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '0.75rem 1rem',
                        color: '#FFE9B5',
                        textDecoration: 'none',
                        fontSize: '15px',
                        fontWeight: 600,
                        borderRadius: '8px',
                      }}
                    >
                      {item.label}
                    </Link>
                  )
                )}
              </div>
            )}
          </div>
        </nav>
      )}

      {/* Overlay para fechar menu "Mais" ao clicar fora */}
      {isMobile && moreOpen && (
        <div
          onClick={() => setMoreOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99,
            background: 'transparent',
          }}
          aria-hidden="true"
        />
      )}

      <main style={{ flex: 1, padding: '1rem', paddingBottom: isMobile ? '100px' : '1rem' }}>
        <Outlet />
      </main>
    </div>
  );
}