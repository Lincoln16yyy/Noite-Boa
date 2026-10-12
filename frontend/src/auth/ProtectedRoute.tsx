import { Navigate, Outlet } from 'react-router-dom';

// Estratégia de sessão: o JWT fica em localStorage (chave "token"),
// escrito pelo Login e removido pelo cliente da API em caso de 401.
export default function ProtectedRoute() {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}
