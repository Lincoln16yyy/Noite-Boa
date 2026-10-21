import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { usePrimeiroUso } from '../hooks/usePrimeiroUso';
import NightBackground from '../components/NightBackground';
import BottomBar from './BottomBar';
import { primeiroNome, saudacao } from '../lib/saudacao';
import { NAV_PRINCIPAL, NAV_SECUNDARIA } from './nav-items';
// CSS dos componentes base: o Layout usa a classe .ui-screen-enter (issue #216)
// e não importa nenhum componente que o puxe sozinho.
import '../components/ui/ui.css';
// Container e grade de duas colunas (issue #217).
import './layout.css';

/** Breakpoint único da navegação (issue #157): até 767px é celular. */
const CONSULTA_CELULAR = '(max-width: 767px)';

/** Rotas protegidas: só acessíveis com usuário logado */
const PROTECTED_ROUTES: string[] = ['/registrar', '/historico', '/dashboard', '/amigos', '/sons', '/configuracoes', '/hoje', '/onboarding'];

/** Rotas de autenticação: só acessíveis SEM usuário logado */
const AUTH_ROUTES: string[] = ['/login', '/cadastro'];

/** Ordem do menu desktop (issue #209: Hoje é a primeira aba). Os mesmos
    itens e ícones da barra inferior, vindos da fonte única (issue #217). */
const MENU_DESKTOP = [...NAV_PRINCIPAL, ...NAV_SECUNDARIA];

export default function Layout() {
  const { user, loading, logout, sessao, erroSessao, tentarNovamente } = useAuth();
  const location = useLocation();
  // Reativo a redimensionamento/rotação (media query do navegador), não um
  // `window.innerWidth` lido uma única vez no primeiro render.
  const isMobile = useMediaQuery(CONSULTA_CELULAR);
  // O token identifica a sessão: muda no login/logout antes de o /me trazer o
  // usuário novo, então o primeiro uso não fica preso ao resultado da conta
  // anterior (review do PR #292).
  const primeiroUso = usePrimeiroUso(!loading && Boolean(user), sessao);

  const rotaProtegida = PROTECTED_ROUTES.some((r) => location.pathname.startsWith(r));

  // Falha de rede/5xx no /me com token presente não é logout: avisa e deixa
  // tentar de novo, em vez de mandar para /login (#294).
  if (!loading && !user && erroSessao && rotaProtegida) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
        <NightBackground />
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            padding: '1.5rem',
            textAlign: 'center',
          }}
        >
          <p role="alert" style={{ color: 'var(--color-lavanda)', margin: 0 }}>{erroSessao}</p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary" onClick={() => void tentarNovamente()}>
              Tentar de novo
            </button>
            {/* Sem o layout normal não haveria como sair: a sessão pode estar
                quebrada de um jeito que só um novo login resolve (#294). */}
            <button type="button" className="btn btn-ghost" onClick={logout}>
              Sair
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Redireciona rotas protegidas se não logado
  if (!loading && !user && rotaProtegida) {
    return <Navigate to="/login" replace />;
  }

  // Redireciona rotas de auth (login/cadastro) e a raiz quando já logado:
  // /hoje é a tela inicial do app (issue #210).
  if (!loading && user && (AUTH_ROUTES.includes(location.pathname) || location.pathname === '/')) {
    return <Navigate to="/hoje" replace />;
  }

  // Primeiro uso (issue #215): quem ainda não registrou noite nem salvou meta
  // vê o fluxo de 3 passos antes da Hoje, uma vez por aparelho. A sonda só
  // roda quando não há indicador no dispositivo, então em quem já usou o app
  // não há chamada extra nenhuma.
  if (!loading && user && primeiroUso.precisa && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // Quem não precisa mais do fluxo não fica preso em /onboarding — por exemplo,
  // a conta trocou depois de um redirecionamento (review do PR #292). Só sai
  // com resposta confirmada: falha de sonda não prova que o fluxo é dispensável.
  if (
    !loading &&
    user &&
    primeiroUso.confirmado &&
    !primeiroUso.precisa &&
    location.pathname === '/onboarding'
  ) {
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
      {/* Header desktop. O conteúdo fica no mesmo container de 1100 px das
          telas (issue #217), para o cabeçalho se alinhar com o corpo. */}
      <header
        style={{
          background: 'var(--color-noite)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
        role="banner"
      >
        <div
          className="app-container"
          style={{
            paddingTop: '0.75rem',
            paddingBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
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
                  {MENU_DESKTOP.map((item) => {
                    const Icone = item.Icone;
                    return (
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
                          gap: '0.4rem',
                          transition: 'color 0.15s, background 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,233,181,0.1)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        {/* Mesmo ícone de traço da barra inferior (issue #217); é
                            decorativo (aria-hidden), o rótulo continua sendo o nome
                            acessível do link. */}
                        <Icone size={18} />
                        {item.label}
                      </Link>
                    );
                  })}
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
        </div>
      </header>

      {/* Bottom bar mobile (só para usuário logado) — issue #209 */}
      {isMobile && user && <BottomBar onLogout={handleLogout} />}

      <main
        className="app-container"
        style={{ flex: 1, paddingTop: '1rem', paddingBottom: isMobile ? '100px' : '1rem' }}
      >
        {/* key = roda a animação de entrada a cada troca de tela (issue #216).
            Com prefers-reduced-motion a classe não anima (ui.css). */}
        <div key={location.pathname} className="ui-screen-enter">
          {/* A chave remonta a página quando a conta muda: o estado que ela
              carregou (formulários, listas) é da sessão anterior (PR #292). */}
          <Outlet key={sessao} />
        </div>
      </main>
    </div>
  );
}