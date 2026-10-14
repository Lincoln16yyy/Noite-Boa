import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Goal, SleepLogPage } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Ring } from '../components/ui';
import { formatHours } from '../lib/dashboard';
import {
  barrasDaSemana,
  comparacaoSemana,
  contagemParaDormir,
  normalizarMeta,
  ultimaNoite,
} from '../lib/hoje';
import type { ResumoComAnterior } from '../lib/hoje';
import LoadingWarning from '../components/LoadingWarning';

/**
 * Tela Hoje (issue #210) — "como foi minha última noite e o que faço agora?".
 * Regras: seção 5 de docs/design/direcao-visual.md; alvo:
 * docs/design/mockups/hoje.png. Todos os números vêm da API (nenhum valor do
 * mockup é copiado).
 */

type Estado = 'carregando' | 'pronto' | 'erro';

/** Dados crus carregados da API. */
interface Carregados {
  ultimoLog: SleepLogPage['content'];
  resumo: ResumoComAnterior | null;
  meta: Goal | null;
}

const telaStyle: CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

const secaoStyle: CSSProperties = { padding: '1.25rem' };

const ringWrapStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.75rem',
};

const centroRingStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.15rem',
};

const duracaoStyle: CSSProperties = {
  fontWeight: 800,
  lineHeight: 1,
  color: 'var(--text-primary)',
};

const porcentagemStyle: CSSProperties = {
  fontSize: '13px',
  color: 'var(--text-muted)',
};

const horariosStyle: CSSProperties = {
  fontSize: '15px',
  color: 'var(--text-secondary)',
};

const dormirCardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: '1rem',
};

const contagemStyle: CSSProperties = {
  fontSize: 'var(--fs-display-sm)',
  fontWeight: 800,
  lineHeight: 1,
  color: 'var(--text-primary)',
};

const metaDormirStyle: CSSProperties = { textAlign: 'right' };

const barrasWrapStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: '0.5rem',
  height: '112px',
  marginTop: '1rem',
};

const colunaStyle: CSSProperties = {
  flex: '1 1 0',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '0.5rem',
  height: '100%',
};

const barraStyle = (cor: 'within' | 'below'): CSSProperties => ({
  width: '100%',
  maxWidth: '28px',
  borderRadius: 'var(--radius-pill)',
  // Mesma regra de cores do Dashboard: Âmbar abaixo da meta, Lavanda dentro.
  background: cor === 'below' ? 'var(--below-meta-graphic)' : 'var(--within-meta-graphic)',
});

const letraStyle: CSSProperties = {
  fontSize: '12px',
  color: 'var(--text-muted)',
};

const botaoLarguraStyle: CSSProperties = { width: '100%' };

const erroStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-start' };

/** "Somente leitores de tela": título da página sem aparecer no mockup. */
const srOnly: CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

export default function Hoje() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fuso = user?.timezone ?? 'America/Sao_Paulo';

  const [estado, setEstado] = useState<Estado>('carregando');
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState<Carregados | null>(null);

  const carregar = useCallback(async () => {
    setEstado('carregando');
    setErro('');
    try {
      const [ultimoLog, resumo, meta] = await Promise.all([
        api.get<SleepLogPage>('/sleep-logs?page=0&size=1'),
        api.get<ResumoComAnterior>('/stats/summary?days=7'),
        api.get<Goal>('/goal'),
      ]);
      setDados({ ultimoLog: ultimoLog?.content, resumo, meta });
      setEstado('pronto');
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : String(err));
      setEstado('erro');
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (estado === 'carregando') {
    return (
      <div style={telaStyle}>
        <p style={{ color: 'var(--text-secondary)' }} role="status">
          Carregando…
        </p>
        <LoadingWarning isLoading={true} />
      </div>
    );
  }

  if (estado === 'erro') {
    return (
      <div style={telaStyle}>
        <h1 style={srOnly}>Hoje</h1>
        <Card style={secaoStyle}>
          <div style={erroStyle} role="alert">
            <p style={{ margin: 0 }}>Não foi possível carregar sua noite: {erro}</p>
            <Button variant="secondary" onClick={() => carregar()}>
              Tentar novamente
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const meta = normalizarMeta(dados?.meta);
  const logs = dados?.ultimoLog ?? [];
  const noite = ultimaNoite(logs, meta.minutos, fuso);
  const resumo = dados?.resumo ?? null;
  const temDadosNaSemana = (resumo?.daily ?? []).length > 0;
  const barras = barrasDaSemana(resumo, meta.minutos / 60, new Date(), fuso);
  const comparacao = comparacaoSemana(resumo);
  const contagem = contagemParaDormir(meta.dormir, new Date(), fuso);

  const registrarNoite = (
    <Button variant="primary" size="md" style={botaoLarguraStyle} onClick={() => navigate('/registrar')}>
      Registrar noite
    </Button>
  );

  return (
    <div style={telaStyle}>
      <h1 style={srOnly}>Hoje</h1>

      {/* Última noite: anel com a duração e a porcentagem da meta */}
      <Card style={secaoStyle}>
        <p className="overline" style={{ margin: '0 0 0.75rem' }}>
          Última noite
        </p>
        {noite ? (
          <div style={ringWrapStyle}>
            <Ring
              label={`Última noite: ${formatHours(noite.minutos / 60)}, ${noite.porcentagem}% da meta`}
              value={noite.porcentagem}
              size={210}
              strokeWidth={20}
              // Âmbar quando abaixo da meta, Lavanda quando dentro (regra do Dashboard).
              tone={noite.porcentagem < 100 ? 'below' : 'within'}
            >
              <span style={centroRingStyle}>
                <span className="display-number" style={{ ...duracaoStyle, fontSize: '42px' }}>
                  {formatHours(noite.minutos / 60)}
                </span>
                <span style={porcentagemStyle}>
                  {noite.porcentagem}% da meta de {Math.round(meta.minutos / 60)}h
                </span>
              </span>
            </Ring>
            <p style={{ ...horariosStyle, margin: 0 }}>
              Dormiu {noite.dormiu} · Acordou {noite.acordou}
            </p>
          </div>
        ) : (
          // Sem registros: estado vazio convidando a registrar (seção 5).
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
            <p style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Nenhuma noite registrada ainda.
            </p>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
              Registre a última noite para ver quanto você dormiu e como está em relação à meta.
            </p>
          </div>
        )}
      </Card>

      {/* Hora de dormir (some quando a meta não tem horário-alvo) */}
      {contagem && (
        <Card style={{ ...secaoStyle, ...dormirCardStyle }}>
          <div>
            <p className="overline" style={{ margin: '0 0 0.5rem' }}>
              Hora de dormir
            </p>
            <p style={{ ...contagemStyle, margin: 0 }}>{contagem}</p>
          </div>
          <p style={{ ...metaDormirStyle, margin: 0 }}>
            <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Meta</span>
            <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>{meta.dormir}</span>
          </p>
        </Card>
      )}

      {registrarNoite}

      {/* Esta semana: barras dos últimos 7 dias + comparação (se houver dado) */}
      {temDadosNaSemana && (
        <Card style={secaoStyle}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' }}>
            <p className="overline" style={{ margin: 0 }}>
              Esta semana
            </p>
            {comparacao && (
              <p
                style={{
                  margin: 0,
                  fontSize: '13px',
                  fontWeight: 700,
                  // Âmbar se pior, Lavanda se melhor (mesma semântica das barras).
                  color: comparacao.cor === 'below' ? 'var(--below-meta-graphic)' : 'var(--within-meta-graphic)',
                }}
              >
                {comparacao.texto}
              </p>
            )}
          </div>
          <div style={barrasWrapStyle}>
            {barras.map((barra) => (
              <div key={barra.date} style={colunaStyle}>
                <span
                  style={{
                    ...barraStyle(barra.cor),
                    height: `${barra.altura}%`,
                    // Dia sem registro: só a letra, sem barra (sem dado falso).
                    visibility: barra.hasData ? 'visible' : 'hidden',
                  }}
                />
                <span style={letraStyle}>{barra.label}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
