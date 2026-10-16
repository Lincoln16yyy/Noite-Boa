import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MoreIcon } from '../components/ui/icons';
import { NAV_PRINCIPAL, NAV_SECUNDARIA } from './nav-items';
import type { NavItem } from './nav-items';

/** Item do menu "Mais" (mobile); `action` marca itens de ação (ex.: Sair). */
interface MoreItem {
  path: string;
  label: string;
  action?: boolean;
}

/**
 * 5 abas principais + "Mais" (issue #209): a aba Hoje é a primeira do app
 * logado. Vem da fonte única de navegação (issue #217), então o desktop usa
 * exatamente os mesmos ícones de traço (24 px).
 */
const BOTTOM_TABS: NavItem[] = NAV_PRINCIPAL;

const MORE_ITEMS: MoreItem[] = [
  ...NAV_SECUNDARIA.map(({ path, label }) => ({ path, label })),
  { path: '/logout', label: 'Sair', action: true },
];

/** Barra: 78 px, fundo escuro translúcido, borda superior sutil (seção 2). */
const estiloBarra: CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  height: '78px',
  boxSizing: 'border-box',
  background: 'var(--tabbar-bg)',
  borderTop: '1px solid var(--surface-border)',
  display: 'flex',
  zIndex: 100,
};

/** Célula da aba: ícone + rótulo, alvo de 44 px, ativo em Luar. */
function estiloAba(ativo: boolean): CSSProperties {
  return {
    flex: '1 1 0',
    minWidth: 0,
    minHeight: '44px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    textDecoration: 'none',
    fontSize: '11px',
    lineHeight: 1.1,
    color: ativo ? 'var(--tab-active)' : 'var(--tab-inactive)',
    fontWeight: ativo ? 700 : 400,
  };
}

const estiloBotaoAba: CSSProperties = {
  ...estiloAba(false),
  background: 'none',
  border: 'none',
  fontFamily: 'inherit',
  cursor: 'pointer',
  padding: 0,
};

export interface BottomBarProps {
  /** Estado de carregamento da sessão: abas desabilitadas. */
  carregando?: boolean;
  /** Ação do item "Sair" do menu Mais. */
  onLogout?: () => void;
}

/**
 * Barra inferior de navegação (issue #209), fiel ao mockup: ícone + rótulo,
 * ativo em Luar (`--tab-active`), inativo em `#8B88C9` (`--tab-inactive`) e
 * `aria-current="page"` na aba corrente. O menu "Mais" abre Sons,
 * Configurações e Sair.
 */
export default function BottomBar({ carregando = false, onLogout }: BottomBarProps) {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (path: string) => location.pathname.startsWith(path);

  const handleLogout = () => {
    setMoreOpen(false);
    onLogout?.();
  };

  const conteudo = (
    <nav aria-label="Navegação principal" style={estiloBarra}>
      {BOTTOM_TABS.map(({ path, label, Icone }) => {
        const ativo = isActive(path);
        if (carregando) {
          return (
            <button key={path} type="button" disabled style={{ ...estiloBotaoAba, opacity: 0.5, cursor: 'not-allowed' }}>
              <Icone />
              <span>{label}</span>
            </button>
          );
        }
        return (
          <Link
            key={path}
            to={path}
            aria-current={ativo ? 'page' : undefined}
            style={estiloAba(ativo)}
          >
            <Icone />
            <span>{label}</span>
          </Link>
        );
      })}

      {carregando ? (
        <button type="button" disabled style={{ ...estiloBotaoAba, opacity: 0.5, cursor: 'not-allowed' }}>
          <MoreIcon />
          <span>Mais</span>
        </button>
      ) : (
        <div style={{ flex: '1 1 0', minWidth: 0, position: 'relative' }}>
          <button
            type="button"
            onClick={() => setMoreOpen(!moreOpen)}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            aria-label={moreOpen ? 'Fechar menu' : 'Mais opções'}
            style={{ ...estiloBotaoAba, width: '100%' }}
          >
            <MoreIcon />
            <span>Mais</span>
          </button>
          {moreOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                bottom: '100%',
                right: 0,
                background: 'var(--color-noite)',
                border: '1px solid var(--color-indigo)',
                borderRadius: '12px 12px 0 0',
                boxShadow: '0 -4px 24px rgba(21,20,46,0.3)',
                padding: '0.5rem',
                minWidth: '180px',
                zIndex: 200,
                animation: 'slideUp 0.15s ease-out',
              }}
            >
              {MORE_ITEMS.map((item) =>
                item.action ? (
                  <button
                    key={item.path}
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.75rem 1rem',
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-ambar)',
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
                      color: 'var(--color-luar)',
                      textDecoration: 'none',
                      fontSize: '15px',
                      fontWeight: 600,
                      borderRadius: '8px',
                    }}
                  >
                    {item.label}
                  </Link>
                ),
              )}
            </div>
          )}
        </div>
      )}
    </nav>
  );

  if (carregando) return conteudo;

  return (
    <>
      {conteudo}
      {moreOpen && (
        <div
          onClick={() => setMoreOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'transparent' }}
          aria-hidden="true"
        />
      )}
    </>
  );
}
