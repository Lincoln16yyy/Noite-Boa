import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const formStyle = { display: 'flex', flexDirection: 'column', gap: '0.9rem', maxWidth: '420px' };

const labelStyle = { display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '15px', fontWeight: 700 };

const fieldStyle = {
  width: '100%',
  minHeight: '48px',
  fontSize: '16px',
  padding: '0.6rem 0.75rem',
  border: '1px solid #C9C6F0',
  borderRadius: '10px',
  background: '#FFFFFF',
  boxSizing: 'border-box',
};

const buttonStyle = {
  minHeight: '52px',
  fontSize: '17px',
  fontWeight: 700,
  border: 'none',
  borderRadius: '10px',
  background: '#15142E',
  color: '#FFE9B5',
  cursor: 'pointer',
};

export default function Cadastro() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('A senha precisa de pelo menos 8 caracteres.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Informe um e-mail válido.');
      return;
    }
    try {
      await api.post('/auth/register', { displayName, email, password });
      navigate('/login', { state: { created: true } });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>Cadastro</h1>
      <form onSubmit={handleSubmit} style={formStyle}>
        <label style={labelStyle}>
          Nome
          <input
            placeholder="Nome"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
            required
            style={fieldStyle}
          />
        </label>
        <label style={labelStyle}>
          E-mail
          <input
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            style={fieldStyle}
          />
        </label>
        <label style={labelStyle}>
          Senha (mín. 8 caracteres)
          <input
            type="password"
            placeholder="Senha (mín. 8 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            style={fieldStyle}
          />
        </label>
        <button type="submit" style={buttonStyle}>
          Criar conta
        </button>
      </form>
      {error && <p role="alert" style={{ color: 'var(--color-erro-texto)' }}>{error}</p>}
      <p style={{ fontSize: '14px' }}>
        Leia como cuidamos dos seus dados na <Link to="/privacidade">Política de Privacidade</Link>.
      </p>
      <p>
        Já tem conta? <Link to="/login">Entrar</Link>
      </p>
    </div>
  );
}
