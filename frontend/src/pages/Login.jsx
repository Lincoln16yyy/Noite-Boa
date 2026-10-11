import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const accountCreated = Boolean(location.state?.created);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const data = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', data.accessToken);
      navigate('/registrar');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="container">
      <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '1.5rem' }}>Login</h1>
      {accountCreated && <p role="status" className="alert alert-success">Conta criada! Faça login.</p>}
      <form onSubmit={handleSubmit} className="form">
        <label className="label">
          E-mail
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className="field"
          />
        </label>
        <label className="label">
          Senha
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="field"
          />
        </label>
        <button type="submit" className="btn btn-primary" style={{ minHeight: '52px', fontSize: '1.06rem' }}>
          Entrar
        </button>
      </form>
      {error && <p role="alert" className="alert alert-error">{error}</p>}
      <p style={{ marginTop: '1.5rem', fontSize: '0.9375rem' }}>
        Não tem conta? <Link to="/cadastro">Cadastre-se</Link>
      </p>
    </div>
  );
}