import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Goal, StatsSummary } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Card, Chip, EmptyState, ErrorState, ProgressBar, Skeleton } from '../components/ui';
import { useCountUp } from '../hooks/useCountUp';
import {
  barraConsistencia,
  buildDailySeries,
  dicaDashboard,
  formatHours,
  formatMinutes,
  minutosQueFaltam,
} from '../lib/dashboard';
import { etiquetaDia, normalizarMeta } from '../lib/hoje';
import LoadingWarning from '../components/LoadingWarning';
// Coluna da tela e grade de duas colunas (issue #217).
import '../layout/layout.css';

/**
 * Dashboard v2 (issue #211) — fiel a docs/design/mockups/dashboard.png.
 * Regras: seção 5 de docs/design/direcao-visual.md. Todos os números vêm da
 * API; gradientes, raio e cores vêm dos tokens (`--bar-*-gradient`,
 * `--chart-bar-radius`, `--below-meta-graphic`, `--within-meta-graphic`).
 */

type Estado = 'carregando' | 'pronto' | 'erro';

/**
 * Coluna da tela: o `maxWidth` (720 px) vem de `.app-tela-larga--720`
 * (issue #217), que estreita no celular e larga no desktop no container.
 */
const telaStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

const overlineStyle: CSSProperties = { margin: '0 0 0.5rem' };

const tituloStyle: CSSProperties = { margin: 0 };

const mediaNumeroStyle: CSSProperties = {
  fontSize: 'var(--fs-display-lg)', // 56 px+ (média é o número gigante)
  fontWeight: 800,
  lineHeight: 1,
  color: 'var(--color-luar)',
  margin: 0,
  fontVariantNumeric: 'tabular-nums',
};

const legendaStyle: CSSProperties = {
  fontSize: '15px',
  color: 'var(--text-secondary)',
  margin: '0.35rem 0 0',
};

const barrasAreaStyle: CSSProperties = {
  position: 'relative',
  height: '130px',
  marginTop: '1.25rem',
};

const linhaMetaStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  borderTop: '1px dashed var(--surface-border)',
  // Anel de foco/legenda: a linha marca a altura da meta na área das barras.
  pointerEvents: 'none',
};

const barrasLinhaStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'flex-end',
  gap: '0.375rem',
  height: '100%',
};

const barraStyle: CSSProperties = {
  flex: '1 1 0',
  minWidth: 0,
  maxWidth: '34px',
  // Centraliza a barra no seu slot: a letra abaixo fica alinhada à barra.
  margin: '0 auto',
  borderRadius: 'var(--chart-bar-radius)', // raio 10 px (seção 2 do guia)
};

const letrasStyle: CSSProperties = {
  display: 'flex',
  gap: '0.375rem',
  marginTop: '0.4rem',
};

const letraStyle: CSSProperties = {
  flex: '1 1 0',
  minWidth: 0,
  textAlign: 'center',
  fontSize: '12px',
  color: 'var(--text-muted)',
};

const metaLegendaStyle: CSSProperties = {
  margin: '0.5rem 0 0',
  textAlign: 'right',
  fontSize: '12px',
  color: 'var(--text-muted)',
};

const metricasGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: '1rem',
};

const metricaValorStyle: CSSProperties = {
  fontSize: '28px',
  fontWeight: 800,
  lineHeight: 1.05,
  margin: 0,
  fontVariantNumeric: 'tabular-nums',
};

const metricaDicaStyle: CSSProperties = {
  margin: '0.75rem 0 0',
  fontSize: '15px',
  lineHeight: 1.45,
};

export default function Dashboard() {
  const { user } = useAuth();
  const fuso = user?.timezone ?? 'America/Sao_Paulo';
  const [days, setDays] = useState(7);
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [status, setStatus] = useState<Estado>('carregando');
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    setStatus('carregando');
    setErrorMessage('');
    try {
      const [summaryData, goalData] = await Promise.all([
        api.get<StatsSummary>(`/stats/summary?days=${days}`),
        api.get<Goal>('/goal'),
      ]);
      setSummary(summaryData);
      setGoal(goalData);
      setStatus('pronto');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setStatus('erro');
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const meta = normalizarMeta(goal);
  const metaHoras = meta.minutos / 60;
  const falta = minutosQueFaltam(summary?.averageHours ?? 0, meta.minutos);
  const divida = Math.max(0, Math.round(summary?.sleepDebtMinutes ?? 0));
  const consistencia = Math.round(summary?.consistencyMinutes ?? 0);

  // Contagem curta do número de destaque (issue #216): só apresentação, o
  // valor real continua em `summary.averageHours`.
  const mediaContada = useCountUp(summary?.averageHours ?? 0);

  // Série das barras: dias do fuso do perfil (mesma série do back-end).
  const serie = buildDailySeries(summary, days, new Date(), fuso);
  const maiorNoite = serie.reduce((max, dia) => Math.max(max, dia.hours), 0);
  const teto = Math.max(metaHoras, maiorNoite) || 1;
  const posicaoMeta = (metaHoras / teto) * 100;

  return (
    <div style={telaStyle} className="app-tela-larga app-tela-larga--720">
      {/* Título da tela: o cabeçalho compartilhado mostra a saudação (#209),
          então overline + título vêm aqui, como no mockup. */}
      <header>
        <p className="overline" style={overlineStyle}>
          Seu padrão
        </p>
        <h1 style={tituloStyle} className="display-number display-sm">
          Dashboard
        </h1>
      </header>

      <div style={{ display: 'flex', gap: '0.5rem' }} role="group" aria-label="Período">
        {[7, 30].map((value) => (
          <Chip key={value} selected={days === value} onClick={() => setDays(value)}>
            {value} dias
          </Chip>
        ))}
      </div>

      {status === 'carregando' && (
        <>
          <Card>
            <Skeleton height={12} width="35%" />
            <Skeleton height={56} width="45%" style={{ marginTop: '0.5rem' }} />
            <Skeleton height={14} width="60%" style={{ marginTop: '0.5rem' }} />
            <Skeleton height={140} style={{ marginTop: '1.25rem' }} />
          </Card>
          <p style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }} role="status">
            Carregando…
          </p>
          <LoadingWarning isLoading={true} />
        </>
      )}

      {status === 'erro' && (
        <ErrorState
          message="Não foi possível carregar as estatísticas."
          detail={errorMessage}
          onRetry={() => load()}
        />
      )}

      {status === 'pronto' && (!summary?.daily || summary.daily.length === 0) && (
        <EmptyState
          title={`Sem dados nos últimos ${days} dias.`}
          description="Registre uma noite de sono para ver sua média, consistência e dívida de sono."
          action={
            <Link to="/registrar" style={{ color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>
              Registrar uma noite →
            </Link>
          }
        />
      )}

      {status === 'pronto' && summary?.daily && summary.daily.length > 0 && (
        /* Duas colunas quando há largura (issue #217): o gráfico de um lado,
           o resumo (métricas + dica) do outro. Abaixo de 960 px é coluna
           única e a ordem de leitura é a mesma de sempre. */
        <div className="app-grade">
          <div className="app-coluna">
          <Card style={{ padding: '1.25rem' }}>
            <p className="overline" style={overlineStyle}>
              Média de {days} dias
            </p>
            <p style={mediaNumeroStyle}>{formatHours(mediaContada)}</p>
            <p style={legendaStyle}>
              Meta de {formatHours(metaHoras)} · {falta > 0 ? `faltam ${falta} min por noite` : 'meta atingida'}
            </p>

            <div
              style={barrasAreaStyle}
              role="img"
              aria-label={`Gráfico de barras: horas dormidas por dia nos últimos ${days} dias, meta de ${formatHours(metaHoras)}`}
            >
              {/* Linha da meta na altura certa (dentro da área, rótulo fora). */}
              <div style={{ ...linhaMetaStyle, top: `${100 - posicaoMeta}%` }} />
              <div style={barrasLinhaStyle}>
                {serie.map((dia) => {
                  const abaixoDaMeta = dia.hours > 0 && dia.hours < metaHoras;
                  return (
                    <span
                      key={dia.date}
                      className="ui-bar-grow"
                      style={{
                        ...barraStyle,
                        // Lavanda se ≥ meta, Âmbar se < meta (gradientes por tema).
                        background: abaixoDaMeta ? 'var(--bar-below-gradient)' : 'var(--bar-within-gradient)',
                        height: dia.hasData ? `${Math.max(4, (dia.hours / teto) * 100)}%` : 0,
                        visibility: dia.hasData ? 'visible' : 'hidden',
                      }}
                    />
                  );
                })}
              </div>
            </div>
            {/* Letras só no período de 7 dias; em 30 dias, as pontas. */}
            {days === 7 ? (
              <div style={letrasStyle}>
                {serie.map((dia) => (
                  <span key={dia.date} style={letraStyle}>
                    {etiquetaDia(dia.date, fuso)}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ ...letrasStyle, justifyContent: 'space-between' }}>
                <span style={letraStyle}>início</span>
                <span style={letraStyle}>hoje</span>
              </div>
            )}
            {/* Rótulo da meta FORA da área das barras (não sobrepõe nada). */}
            <p style={metaLegendaStyle}>- - meta de {formatHours(metaHoras)}</p>
          </Card>
          </div>

          <div className="app-coluna">
          {/* Consistência e dívida (duas colunas a partir de ~340px, como o mockup) */}
          <div style={{ ...metricasGridStyle, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <Card style={{ padding: '1.25rem' }}>
              <p className="overline" style={overlineStyle}>
                Consistência
              </p>
              <p style={metricaValorStyle}>±{consistencia} min</p>
              <div style={{ marginTop: '0.75rem' }}>
                <ProgressBar value={barraConsistencia(consistencia)} label="Consistência do horário de dormir" />
              </div>
              <p style={{ ...legendaStyle, fontSize: '13px' }}>horário de dormir</p>
            </Card>

            <Card style={{ padding: '1.25rem' }}>
              <p className="overline" style={overlineStyle}>
                Dívida de sono
              </p>
              <p
                style={{
                  ...metricaValorStyle,
                  // Âmbar (do tema) quando há dívida; o rótulo sempre em texto.
                  color: divida > 0 ? 'var(--below-meta-graphic)' : 'var(--text-primary)',
                }}
              >
                {formatMinutes(divida)}
              </p>
              <div style={{ marginTop: '0.75rem' }}>
                <ProgressBar
                  value={Math.min(100, (divida / (7 * meta.minutos)) * 100)}
                  label="Dívida de sono em relação à meta da semana"
                  tone={divida > 0 ? 'below' : 'within'}
                />
              </div>
              <p style={{ ...legendaStyle, fontSize: '13px' }}>nos últimos 7 dias</p>
            </Card>
          </div>

          {/* Dica determinística */}
          <Card style={{ padding: '1.25rem' }}>
            <p className="overline" style={{ ...overlineStyle, color: 'var(--below-meta-graphic)' }}>
              Dica
            </p>
            <p style={{ ...metricaDicaStyle, color: 'var(--text-primary)' }}>{dicaDashboard(divida)}</p>
          </Card>
          </div>
        </div>
      )}
    </div>
  );
}
