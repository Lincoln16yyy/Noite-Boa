import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { formatHours, formatMinutes } from '../lib/dashboard';
import { useAuth } from '../context/AuthContext';
import LoadingWarning from '../components/LoadingWarning';
import styles from './Dashboard.module.css';

// Recharts pesa o bundle: o gráfico só carrega quando o dashboard precisa dele.
const SleepChart = lazy(() => import('../components/SleepChart'));

// Estilos usando tokens CSS (ver docs/identidade-visual.md)
const sectionStyle: React.CSSProperties = {
  background: 'var(--color-noite)',
  borderRadius: '28px',
  padding: '1.5rem',
  marginBottom: '1.25rem',
  boxShadow: 'var(--shadow-card)',
  color: 'var(--color-luar)',
  // Borda sutil: no modo escuro o cartão (fundo Noite) some contra o fundo da
  // página (também Noite); a borda Índigo o separa (#158).
  border: '1px solid var(--color-indigo)',
};

const metricCardStyle: React.CSSProperties = {
  background: 'var(--color-nevoa)',
  border: '1px solid var(--color-indigo)',
  borderRadius: '20px',
  padding: '1.25rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
};

const metricTitleStyle: CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  color: 'var(--color-indigo)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const metricValueStyle: CSSProperties = {
  fontSize: '36px',
  fontWeight: 800,
  color: 'var(--color-noite)',
  lineHeight: 1.1,
};

const metricHintStyle: CSSProperties = {
  fontSize: '13px',
  color: 'var(--color-indigo)',
  opacity: 0.7,
};

const periodToggleStyle = (active: boolean): CSSProperties => ({
  minHeight: '48px',
  padding: '0 1rem',
  fontSize: '15px',
  fontWeight: active ? 700 : 400,
  borderRadius: '999px',
  // Tokens de TEMA: no modo escuro a pílula inativa não fica mais branca (#158).
  border: active ? '2px solid var(--toggle-active-bg)' : '1px solid var(--toggle-border)',
  background: active ? 'var(--toggle-active-bg)' : 'var(--toggle-bg)',
  color: active ? 'var(--toggle-active-text)' : 'var(--text-secondary)',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
});

const buttonStyle = {
  minHeight: '48px',
  padding: '0.75rem 1.5rem',
  fontSize: '16px',
  fontWeight: 700,
  borderRadius: '999px',
  border: 'none',
  background: 'var(--color-ambar)',
  color: 'var(--color-noite)',
  cursor: 'pointer',
  transition: 'background 0.15s, transform 0.1s',
};

const emptyStateStyle = {
  background: 'var(--color-nevoa)',
  border: '1px solid var(--color-lavanda)',
  borderRadius: '20px',
  padding: '2rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  alignItems: 'flex-start',
  textAlign: 'left',
};

const errorStateStyle = {
  background: 'var(--color-nevoa)',
  border: '2px solid var(--color-erro)',
  borderRadius: '20px',
  padding: '1.25rem',
  color: 'var(--color-erro-texto)',
};

const loadingStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '3rem',
  color: 'var(--color-lavanda)',
};

const sectionTitleStyle = {
  fontSize: '18px',
  fontWeight: 800,
  marginTop: 0,
  marginBottom: '1rem',
  color: 'var(--color-luar)',
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '0.875rem',
  marginBottom: '1.25rem',
};

const mainNumberStyle = {
  fontSize: 'clamp(48px, 8vw, 72px)',
  fontWeight: 800,
  color: 'var(--color-luar)',
  lineHeight: 1,
  margin: 0,
};

const mainLabelStyle = {
  fontSize: '15px',
  fontWeight: 600,
  color: 'var(--color-lavanda)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: '0.25rem',
};

const mainSubtitleStyle = {
  fontSize: '14px',
  color: 'var(--color-lavanda)',
  opacity: 0.7,
  marginTop: '0.5rem',
};

const goalLineStyle = {
  fontSize: '13px',
  color: 'var(--color-ambar)',
  fontWeight: 600,
  marginTop: '0.75rem',
};

function Metric({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div style={metricCardStyle}>
      <div style={metricTitleStyle}>{title}</div>
      <div style={metricValueStyle}>{value}</div>
      <div style={metricHintStyle}>{hint}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [days, setDays] = useState(7);
  const [summary, setSummary] = useState<any>(null);
  const [goal, setGoal] = useState<any>(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async (selectedDays: number, signal?: AbortSignal) => {
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
    } catch (err: any) {
      if (err.name === 'AbortError') return; // ignora cancelamento
      setErrorMessage(err.message);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(days, controller.signal);
    return () => controller.abort(); // cancela requisição anterior ao trocar de período
  }, [days, load]);

  const goalHours = goal ? goal.targetMinutes / 60 : 8;
  const isEmpty = status === 'ready' && (!summary?.daily || summary.daily.length === 0);

  return (
    <div className={styles.container}>
      <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '0.5rem' }}>Dashboard</h1>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' } as CSSProperties} role="group" aria-label="Período">
        {[7, 30].map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={days === value}
            style={periodToggleStyle(days === value)}
            onClick={() => setDays(value)}
          >
            {value} dias
          </button>
        ))}
      </div>

      {status === 'loading' && (
        <div style={loadingStyle as CSSProperties}>
          <p>Carregando…</p>
          <LoadingWarning isLoading={true} />
        </div>
      )}

      {status === 'error' && (
        <div role="alert" style={errorStateStyle}>
          <p style={{ marginTop: 0, marginBottom: '1rem' }}>Não foi possível carregar as estatísticas: {errorMessage}</p>
          <button type="button" style={buttonStyle} onClick={() => load(days)}>
            Tentar novamente
          </button>
        </div>
      )}

      {isEmpty && (
        <div style={emptyStateStyle as CSSProperties}>
          <p style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: 'var(--color-noite)' }}>Sem dados nos últimos {days} dias.</p>
          <p style={{ margin: 0, color: 'var(--color-indigo)', opacity: 0.8 }}>
            Registre uma noite de sono para ver sua média, consistência e dívida de sono.
          </p>
          <Link to="/registrar" style={{ color: 'var(--color-ambar)', fontWeight: 700, textDecoration: 'none', marginTop: '0.25rem' }}>
            Registrar uma noite →
          </Link>
        </div>
      )}

      {status === 'ready' && !isEmpty && summary && (
        <>
          {/* Cartão principal escuro com média grande + gráfico */}
          <section aria-label="Resumo do sono" style={sectionStyle} className={styles.resumo}>
            <div className={styles.resumoTexto}>
              <div style={mainLabelStyle}>Média de {days} dias</div>
              <div style={mainNumberStyle}>{formatHours(summary.averageHours)}</div>
              <div style={mainSubtitleStyle}>por noite registrada</div>
              <div style={goalLineStyle}>Meta: {goalHours}h por noite</div>
            </div>

            <section aria-label="Horas dormidas por dia">
              <h2 style={sectionTitleStyle}>Horas dormidas por dia</h2>
              <Suspense fallback={<p style={{ color: 'var(--color-lavanda)' }}>Carregando gráfico…</p>}>
                <SleepChart summary={summary} days={days} goalHours={goalHours} timeZone={user?.timezone} />
              </Suspense>
            </section>
          </section>

          {/* Métricas secundárias em cartões claros */}
          <div style={gridStyle}>
            <Metric
              title={`Consistência (${days} dias)`}
              value={`±${Math.round(summary.consistencyMinutes)} min`}
              hint="variação do horário de dormir; quanto menor, melhor"
            />
            <Metric
              title="Dívida de sono (7 noites)"
              value={formatMinutes(summary.sleepDebtMinutes)}
              hint={`falta para a meta de ${goalHours}h por noite`}
            />
          </div>
        </>
      )}
    </div>
  );
}