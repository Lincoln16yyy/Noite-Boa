import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './layout/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Cadastro from './pages/Cadastro';
import Privacidade from './pages/Privacidade';
import Registrar from './pages/Registrar';
import Historico from './pages/Historico';
import Dashboard from './pages/Dashboard';
import Configuracoes from './pages/Configuracoes';
import Amigos from './pages/Amigos';
import ProtectedRoute from './auth/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/registrar" element={<Registrar />} />
            <Route path="/historico" element={<Historico />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/amigos" element={<Amigos />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
