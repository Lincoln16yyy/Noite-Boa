import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { formatHours, formatMinutes } from '../lib/dashboard';
import LoadingWarning from '../components/LoadingWarning';

// Recharts pesa o bundle: o gráfico só carrega quando o dashboard precisa dele.
const SleepChart = lazy(() => import('../components/SleepChart'));

const cardStyle = {
  background: '#FFFFFF',
  border: '1px solid #C9C6F0',
  borderRadius: '10px',
  padding: '0.75rem',
};

const toggleButtonStyle = (active) => ({
  minHeight: '44px',
  padding: '0 1rem',
  fontSize: '15px',
  fontWeight: active ? 700 : 400,
  borderRadius: '10px',
  border: active ? '2px solid #15142E' : '1px solid #C9C6F0',
  background: active ? '#FFE9B5' : '#FFFFFF',
  cursor: 'pointer',
});

function Metric({ title, value, hint }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: '13px', color: '#4B4A6B' }}>{title}</div>
      <div style={{ fontSize: '26px', fontWeight: 700, color: '#15142E' }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#4B4A6B' }}>{hint}</div>
    </div>
  );
}

export default function Dashboard() {
  const [days, setDays] = useState(7);
  const [summary, setSummary] = useState(null);
  const [goal, setGoal] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async (selectedDays) => {
    setStatus('loading');
    setErrorMessage('');
    try {
      const [summaryData, goalData] = await Promise.all([
        api.get(`/stats/summary?days=${selectedDays}`),
        api.get('/goal'),
      ]);
      setSummary(summaryData);
      setGoal(goalData);
      setStatus('ready');
    } catch (err) {
      setErrorMessage(err.message);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [days, load]);

  const goalHours = goal ? goal.targetMinutes / 60 : 8;
  const isEmpty = status === 'ready' && (!summary?.daily || summary.daily.length === 0);

  return (
    <div style={{ maxWidth: '640px' }}>
      <h1>Dashboard</h1>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }} role="group" aria-label="Período">
        {[7, 30].map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={days === value}
            style={toggleButtonStyle(days === value)}
            onClick={() => setDays(value)}
          >
            {value} dias
          </button>
        ))}
      </div>

      {status === 'loading' && (
        <>
          <p>Carregando…</p>
          <LoadingWarning isLoading={true} />
        </>
      )}

      {status === 'error' && (
        <div role="alert" style={{ ...cardStyle, borderColor: '#E5484D' }}>
          <p style={{ marginTop: 0, color: 'var(--color-erro-texto)' }}>Não foi possível carregar as estatísticas: {errorMessage}</p>
          <button type="button" style={toggleButtonStyle(false)} onClick={() => load(days)}>
            Tentar novamente
          </button>
        </div>
      )}

      {isEmpty && (
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
          <p style={{ margin: 0 }}>Sem dados nos últimos {days} dias.</p>
          <p style={{ margin: 0, color: '#4B4A6B' }}>
            Registre uma noite de sono para ver sua média, consistência e dívida de sono.
          </p>
          <Link to="/registrar" style={{ color: '#15142E', fontWeight: 700 }}>
            Registrar uma noite →
          </Link>
        </div>
      )}

      {status === 'ready' && !isEmpty && summary && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <Metric
              title={`Média de horas (${days} dias)`}
              value={formatHours(summary.averageHours)}
              hint="por noite registrada"
            />
            <Metric
              title="Consistência"
              value={`±${Math.round(summary.consistencyMinutes)} min`}
              hint="variação do horário de dormir; quanto menor, melhor"
            />
            <Metric
              title="Dívida de sono (7 noites)"
              value={formatMinutes(summary.sleepDebtMinutes)}
              hint={`falta para a meta de ${goalHours}h por noite`}
            />
          </div>

          <section aria-label="Horas dormidas por dia" style={cardStyle}>
            <h2 style={{ fontSize: '16px', marginTop: 0 }}>Horas dormidas por dia</h2>
            <Suspense fallback={<p>Carregando gráfico…</p>}>
              <SleepChart summary={summary} days={days} goalHours={goalHours} />
            </Suspense>
          </section>
        </>
      )}
    </div>
  );
}
