import { Link, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div style={{ fontFamily: 'Nunito, system-ui, sans-serif', background: '#F5F3FF', minHeight: '100vh' }}>
      <header style={{ padding: '1rem', background: '#15142E' }}>
        <nav style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to="/" style={{ color: '#FFE9B5' }}>Noite Boa</Link>
          <Link to="/login" style={{ color: '#B9B6FF' }}>Login</Link>
          <Link to="/cadastro" style={{ color: '#B9B6FF' }}>Cadastro</Link>
          <Link to="/registrar" style={{ color: '#B9B6FF' }}>Registrar</Link>
          <Link to="/historico" style={{ color: '#B9B6FF' }}>Histórico</Link>
          <Link to="/dashboard" style={{ color: '#B9B6FF' }}>Dashboard</Link>
          <Link to="/amigos" style={{ color: '#B9B6FF' }}>Amigos</Link>
          <Link to="/sons" style={{ color: '#B9B6FF' }}>Sons</Link>
          <Link to="/configuracoes" style={{ color: '#B9B6FF' }}>Config</Link>
        </nav>
      </header>
      <main style={{ padding: '1rem' }}>
        <Outlet />
      </main>
    </div>
  );
}
