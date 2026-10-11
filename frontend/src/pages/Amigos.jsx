import { useEffect, useState } from 'react';
import { api } from '../api/client';
import LoadingWarning from '../components/LoadingWarning';

const fieldStyle = {
  width: '100%',
  minHeight: '48px',
  fontSize: '16px',
  padding: '0.6rem 0.75rem',
  border: '1px solid var(--input-border)',
  borderRadius: '10px',
  background: 'var(--input-bg)',
  boxSizing: 'border-box',
};

const buttonStyle = {
  minHeight: '48px',
  fontSize: '16px',
  fontWeight: 700,
  borderRadius: '10px',
  border: 'none',
  background: 'var(--btn-primary-bg)',
  color: 'var(--btn-primary-text)',
  cursor: 'pointer',
};

const smallButtonStyle = {
  minHeight: '44px',
  padding: '0 0.9rem',
  fontSize: '15px',
  borderRadius: '10px',
  border: '1px solid var(--card-border)',
  background: 'var(--bg-secondary)',
  cursor: 'pointer',
};

const cardStyle = {
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: '12px',
  padding: '0.75rem',
  marginBottom: '0.5rem',
};

const rowStyle = { display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' };

const mutedTextStyle = { color: 'var(--text-muted)', fontSize: '15px' };

/**
 * Amigos e ranking de noites registradas (issue #39, nome da #142).
 * Privacidade primeiro: sem opt-in, o usuário não aparece no ranking dos amigos;
 * e o ranking só mostra nº de noites e % dos dias — nunca horários ou durações.
 */
export default function Amigos() {
  const [me, setMe] = useState(null);
  const [amigos, setAmigos] = useState([]);
  const [convites, setConvites] = useState({ sent: [], received: [] });
  const [ranking, setRanking] = useState([]);
  const [dias, setDias] = useState(7);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function carregar(periodo = dias) {
    const [meData, amigosData, convitesData, rankingData] = await Promise.all([
      api.get('/me'),
      api.get('/friends'),
      api.get('/friends/requests'),
      api.get(`/friends/ranking?days=${periodo}`),
    ]);
    setMe(meData);
    setAmigos(amigosData);
    setConvites(convitesData);
    setRanking(rankingData.ranking);
  }

  useEffect(() => {
    carregar()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function alternarCompartilhar(e) {
    const compartilhar = e.target.checked;
    setError('');
    try {
      const atualizado = await api.put('/me', { shareWithFriends: compartilhar });
      setMe(atualizado);
    } catch (err) {
      setError(err.message);
    }
  }

  async function enviarConvite(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const resultado = await api.post('/friends/requests', { email });
      setEmail('');
      setSuccess(
        resultado.status === 'accepted'
          ? `Convite mútuo: vocês agora são amigos de ${resultado.friend.displayName}.`
          : `Convite enviado para ${resultado.friend.displayName}. Aguarde o aceite.`,
      );
      await carregar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function executar(acao, aoPronto) {
    setError('');
    try {
      await acao();
      await aoPronto();
    } catch (err) {
      setError(err.message);
    }
  }

  async function trocarPeriodo(novosDias, signal) {
    setDias(novosDias);
    try {
      const resultado = await api.get(`/friends/ranking?days=${novosDias}`, { signal });
      setRanking(resultado.ranking);
    } catch (err) {
      if (err.name === 'AbortError') return; // ignora cancelamento
      setError(err.message);
    }
  }

  if (loading) return (
    <>
      <p>Carregando…</p>
      <LoadingWarning isLoading={true} />
    </>
  );

  return (
    <div style={{ maxWidth: '560px' }}>
      <h1>Amigos</h1>

      <section aria-label="Compartilhar minhas noites registradas" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '18px' }}>Compartilhar minhas noites registradas</h2>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            minHeight: '44px',
            fontSize: '16px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={Boolean(me?.shareWithFriends)}
            onChange={alternarCompartilhar}
            style={{ width: '24px', height: '24px', accentColor: 'var(--color-ambar)' }}
          />
          Compartilhar minhas noites registradas com amigos
        </label>
        <p style={{ ...mutedTextStyle, marginTop: '0.35rem' }}>
          Seus horários e registros nunca aparecem no ranking — só quantas noites você registrou e em que porcentagem
          dos dias. Você pode desativar quando quiser.
        </p>
      </section>

      <section aria-label="Convidar" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '18px' }}>Convidar alguém</h2>
        <form onSubmit={enviarConvite} style={{ ...rowStyle, marginTop: '0.5rem' }}>
          <label style={{ flex: '1 1 220px' }}>
            E-mail do amigo
            <input
              type="email"
              style={fieldStyle}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="amigo@exemplo.com"
              required
            />
          </label>
          <button type="submit" style={{ ...smallButtonStyle, alignSelf: 'flex-end' }}>
            Enviar convite
          </button>
        </form>
        <p style={{ ...mutedTextStyle, marginTop: '0.35rem' }}>
          O convite só vira amizade quando a outra pessoa aceitar.
        </p>
      </section>

      {error && (
        <div role="alert" style={{ ...cardStyle, borderColor: 'var(--color-erro)', marginBottom: '0.75rem' }}>
          <p style={{ marginTop: 0, color: 'var(--color-erro-texto)' }}>{error}</p>
          <button type="button" style={smallButtonStyle} onClick={() => carregar(dias)}>
            Tentar novamente
          </button>
        </div>
      )}
      {success && (
        <p role="status" style={{ color: 'var(--color-sucesso-texto)' }}>
          {success}
        </p>
      )}

      <section aria-label="Convites recebidos" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '18px' }}>Convites recebidos</h2>
        {convites.received.length === 0 && <p style={mutedTextStyle}>Nenhum convite recebido.</p>}
        {convites.received.map((convite) => (
          <div key={convite.id} style={cardStyle}>
            <div style={rowStyle}>
              <span style={{ flex: '1 1 160px', fontWeight: 700 }}>{convite.friend.displayName}</span>
              <button
                type="button"
                style={smallButtonStyle}
                onClick={() =>
                  executar(
                    () => api.post(`/friends/requests/${convite.id}/accept`),
                    () => carregar(),
                  )
                }
              >
                Aceitar
              </button>
              <button
                type="button"
                style={{ ...smallButtonStyle, background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}
                onClick={() =>
                  executar(
                    () => api.post(`/friends/requests/${convite.id}/decline`),
                    () => carregar(),
                  )
                }
              >
                Recusar
              </button>
            </div>
          </div>
        ))}
      </section>

      <section aria-label="Convites enviados" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '18px' }}>Convites enviados</h2>
        {convites.sent.length === 0 && <p style={mutedTextStyle}>Nenhum convite enviado.</p>}
        {convites.sent.map((convite) => (
          <div key={convite.id} style={cardStyle}>
            <div style={rowStyle}>
              <span style={{ flex: '1 1 160px', fontWeight: 700 }}>{convite.friend.displayName}</span>
              <span style={mutedTextStyle}>aguardando resposta</span>
              <button
                type="button"
                style={{ ...smallButtonStyle, background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}
                onClick={() =>
                  executar(
                    () => api.delete(`/friends/requests/${convite.id}`),
                    () => carregar(),
                  )
                }
              >
                Cancelar
              </button>
            </div>
          </div>
        ))}
      </section>

      <section aria-label="Meus amigos" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '18px' }}>Meus amigos</h2>
        {amigos.length === 0 && <p style={mutedTextStyle}>Você ainda não tem amigos aceitos.</p>}
        {amigos.map((amigo) => (
          <div key={amigo.id} style={cardStyle}>
            <div style={rowStyle}>
              <span style={{ flex: '1 1 160px', fontWeight: 700 }}>{amigo.displayName}</span>
              {!amigo.sharesData && <span style={mutedTextStyle}>não compartilha dados</span>}
              <button
                type="button"
                style={{ ...smallButtonStyle, background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}
                onClick={() =>
                  executar(
                    () => api.delete(`/friends/${amigo.id}`),
                    () => carregar(),
                  )
                }
              >
                Remover
              </button>
            </div>
          </div>
        ))}
      </section>

      <section aria-label="Ranking de noites registradas" style={{ marginBottom: '1.5rem' }}>
        <div style={{ ...rowStyle, justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '18px', margin: 0 }}>Ranking de noites registradas</h2>
          <div style={rowStyle}>
            {[7, 30].map((opcao) => (
              <button
                key={opcao}
                type="button"
                aria-pressed={dias === opcao}
                onClick={() => {
                  const controller = new AbortController();
                  trocarPeriodo(opcao, controller.signal);
                }}
                style={{
                  ...smallButtonStyle,
                  background: dias === opcao ? 'var(--color-noite)' : 'var(--bg-secondary)',
                  color: dias === opcao ? 'var(--color-luar)' : 'var(--text-primary)',
                  border: '1px solid var(--card-border)',
                }}
              >
                {opcao} dias
              </button>
            ))}
          </div>
        </div>
        <p style={{ ...mutedTextStyle, marginTop: '0.35rem' }}>
          Só entram quem é amigo aceito e compartilhou suas noites registradas. O ranking mostra apenas quantas noites
          você registrou e em que porcentagem dos dias — nunca horários ou durações.
        </p>
        {ranking.map((linha, index) => (
          <div key={linha.userId} style={cardStyle}>
            <div style={rowStyle}>
              <span style={{ fontWeight: 700, minWidth: '1.5rem' }}>{index + 1}º</span>
              <span style={{ flex: '1 1 140px', fontWeight: 700 }}>
                {linha.displayName}
                {linha.isMe ? ' (você)' : ''}
              </span>
              <span style={{ fontWeight: 700 }}>
                {linha.nights} {linha.nights === 1 ? 'noite' : 'noites'} · {linha.consistencyPercent}% dos dias
              </span>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}