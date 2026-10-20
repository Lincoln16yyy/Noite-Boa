import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function Cadastro() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  // Requisição em andamento (#274): dois cliques seguidos criariam duas contas e
  // consumiriam o limite por IP (5/hora) do cadastro. O ref é o cadeado; o estado
  // só controla o `disabled` (dois handlers no mesmo batch veem o estado antigo).
  const [saving, setSaving] = useState(false);
  const emVoo = useRef(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (emVoo.current) return;
    setError('');
    if (password.length < 8) {
      setError('A senha precisa de pelo menos 8 caracteres.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Informe um e-mail válido.');
      return;
    }
    emVoo.current = true;
    setSaving(true);
    try {
      await api.post('/auth/register', { displayName, email, password });
      navigate('/login', { state: { created: true } });
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
      <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '1.5rem' }}>Cadastro</h1>
      <form onSubmit={handleSubmit} className="form">
        <label className="label">
          Nome
          <input
            placeholder="Nome"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
            required
            className="field"
          />
        </label>
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
          Senha (mín. 8 caracteres)
          <input
            type="password"
            placeholder="Senha (mín. 8 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
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
          Criar conta
        </button>
      </form>
      {error && <p role="alert" className="alert alert-error">{error}</p>}
      <p style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
        Leia como cuidamos dos seus dados na <Link to="/privacidade">Política de Privacidade</Link>.
      </p>
      <p style={{ marginTop: '0.5rem' }}>
        Já tem conta? <Link to="/login">Entrar</Link>
      </p>
    </div>
  );
}