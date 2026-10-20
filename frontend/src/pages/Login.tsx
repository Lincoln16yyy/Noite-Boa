import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  // Requisição em andamento (#274): sem isso, dois cliques seguidos disparam dois
  // logins e consomem o limite por IP (5/hora), podendo virar 429.
  // O ref é o cadeado de verdade: estado é snapshot e dois handlers no mesmo
  // batch veriam `saving = false` (review do Sourcery no PR #291).
  const [saving, setSaving] = useState(false);
  const emVoo = useRef(false);
  const { login } = useAuth();
  const location = useLocation();
  const accountCreated = Boolean(location.state?.created);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (emVoo.current) return;
    emVoo.current = true;
    setSaving(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      // O cliente de API sempre lança Error; o fallback cobre erros não padrão.
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      emVoo.current = false;
      setSaving(false);
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
        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving}
          style={{ minHeight: '52px', fontSize: '1.06rem' }}
        >
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