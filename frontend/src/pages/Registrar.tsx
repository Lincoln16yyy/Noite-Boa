import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { api } from '../api/client';
import type { Goal, SleepLog, SleepLogPage } from '../api/types';
import { useAuth } from '../context/AuthContext';
import {
  formatarDuracaoLonga,
  formatDuration,
  formatLocal,
  minutosEntre,
  porcentagemDaMeta,
  rotuloDiaRelativo,
  smartDefaults,
  toApiPayload,
  validateSleepForm,
} from '../lib/sleep';
import { isoDateNoFuso } from '../lib/fuso';
import { normalizarMeta } from '../lib/hoje';
import { MSG_SESSAO_MUDOU, sessaoDaTelaAindaVale } from '../lib/sessao-da-tela';
import LoadingWarning from '../components/LoadingWarning';
import QualitySelector from '../components/QualitySelector';
import { Button, Card } from '../components/ui';

/**
 * Registrar noite v2 (issue #212) — fiel a docs/design/mockups/registrar.png.
 * Regras: seção 5 de docs/design/direcao-visual.md. Duração ao vivo, blocos
 * grandes de horário com `datetime-local` real, qualidade em radiogroup,
 * observação opcional e envio sem duplo clique.
 */

/** Meta padrão do app quando o /goal não informa: 8h. */
const META_PADRAO = 480;

const telaStyle: CSSProperties = {
  maxWidth: '480px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

const duracaoCardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.25rem',
  padding: '1.25rem',
};

const duracaoNumeroStyle: CSSProperties = {
  margin: 0,
  fontSize: 'var(--fs-display-lg)', // 56 px+ (seção 5 do guia)
  fontWeight: 800,
  lineHeight: 1,
  // --text-primary: Luar no escuro, Noite no claro (creme sumia no branco).
  color: 'var(--text-primary)',
  fontVariantNumeric: 'tabular-nums',
};

const duracaoLegendaStyle: CSSProperties = {
  margin: 0,
  fontSize: '15px',
  color: 'var(--text-secondary)',
};

const blocosGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '0.75rem',
};

const formStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

const blocoStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.15rem',
  padding: '1rem',
  cursor: 'pointer',
};

const blocoHoraStyle: CSSProperties = {
  fontSize: '30px',
  fontWeight: 800,
  lineHeight: 1.1,
  // --text-primary: Luar no escuro, Noite no claro.
  color: 'var(--text-primary)',
  fontVariantNumeric: 'tabular-nums',
};

const blocoLegendaStyle: CSSProperties = {
  fontSize: '12px',
  color: 'var(--text-muted)',
};

const erroStyle: CSSProperties = { borderColor: 'var(--color-erro)' };

const recenteItemStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--surface-border)',
  borderRadius: '10px',
  padding: '0.6rem 0.75rem',
};

/** 'YYYY-MM-DDTHH:mm' → 'HH:mm' (vazio → '--:--'). */
function horaVisivel(valor: string): string {
  return valor.split('T')[1] ?? '--:--';
}

/** 'YYYY-MM-DDTHH:mm' → 'YYYY-MM-DD'. */
function dataVisivel(valor: string): string {
  return valor.split('T')[0] ?? '';
}

export default function Registrar() {
  const { user, sessao } = useAuth();
  // Sessão atual do contexto para as checagens espalhadas por callbacks.
  const sessaoAtual = useRef(sessao);
  sessaoAtual.current = sessao;
  const fuso = user?.timezone; // fonte única: fuso do perfil (issue #102)
  const [sleepStart, setSleepStart] = useState<string>('');
  const [sleepEnd, setSleepEnd] = useState<string>('');
  const [quality, setQuality] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [metaMinutos, setMetaMinutos] = useState<number>(META_PADRAO);
  const [recent, setRecent] = useState<SleepLog[]>([]);
  const [recentLoaded, setRecentLoaded] = useState<boolean>(false);
  const digitouRef = useRef(false); // não repor o digitado quando o fuso do perfil chegar (#102)
  // Sessão que abriu o formulário: se o contexto trocar de conta com a tela
  // montada, o que foi digitado para A não pode ser salvo em B (#298).
  const tokenDaTela = useRef<string | null>(sessao);

  const applyDefaults = useCallback(() => {
    const defaults = smartDefaults(new Date(), fuso);
    setSleepStart(defaults.sleepStart);
    setSleepEnd(defaults.sleepEnd);
  }, [fuso]);

  const loadRecent = useCallback(async () => {
    const sessaoDaLeitura = sessao;
    try {
      const page = await api.get<SleepLogPage>('/sleep-logs?page=0&size=5', {
        token: sessaoDaLeitura ?? undefined,
      });
      // Resposta de outra conta não entra nesta tela (#298).
      if (!sessaoDaTelaAindaVale(sessaoDaLeitura, sessaoAtual.current)) return;
      setRecent(page.content ?? []);
    } catch {
      if (sessaoDaTelaAindaVale(sessaoDaLeitura, sessaoAtual.current)) setRecent([]);
    } finally {
      // Só a leitura da sessão atual encerra o "carregando" dos últimos
      // registros; a antiga não pode liberar o estado vazio da nova (#298).
      if (sessaoDaTelaAindaVale(sessaoDaLeitura, sessaoAtual.current)) setRecentLoaded(true);
    }
  }, [sessao]);

  // Meta para a porcentagem da duração ao vivo (default 8h sem o /goal).
  useEffect(() => {
    const sessaoDaLeitura = sessao;
    api
      .get<Goal>('/goal', { token: sessaoDaLeitura ?? undefined })
      .then((goal) => {
        if (sessaoDaTelaAindaVale(sessaoDaLeitura, sessaoAtual.current)) setMetaMinutos(normalizarMeta(goal).minutos);
      })
      .catch(() => {
        if (sessaoDaTelaAindaVale(sessaoDaLeitura, sessaoAtual.current)) setMetaMinutos(META_PADRAO);
      });
  }, [sessao]);

  // Padrões com o fuso do perfil assim que ele chegar (o /me é assíncrono);
  // quem já digitou um horário não tem o campo reposto no meio da edição.
  useEffect(() => {
    if (!digitouRef.current) applyDefaults();
  }, [applyDefaults]);

  // Troca de sessão: o formulário e os últimos registros eram da conta
  // anterior; volta aos padrões da nova (#298).
  useEffect(() => {
    digitouRef.current = false;
    setSleepStart('');
    setSleepEnd('');
    setQuality(0);
    setNotes('');
    applyDefaults();
    setRecent([]);
    setRecentLoaded(false);
    setMetaMinutos(META_PADRAO);
    setSuccess('');
    setError('');
    // Só a troca de sessão deve resetar o formulário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao]);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  // Duração ao vivo: recalculada a cada mudança de horário (issue #212).
  const minutos = minutosEntre(sleepStart, sleepEnd, fuso);
  const porcentagem = minutos === null ? null : porcentagemDaMeta(minutos, metaMinutos);
  const hojeIso = isoDateNoFuso(new Date(), fuso ?? 'America/Sao_Paulo');

  async function handleSalvar() {
    if (saving) return; // guarda extra contra duplo envio (#99)
    setError('');
    setSuccess('');
    const form = { sleepStart, sleepEnd, quality, notes };
    const problem = validateSleepForm(form);
    if (problem) {
      setError(problem);
      return;
    }
    const token = tokenDaTela.current;
    if (!sessaoDaTelaAindaVale(token, sessaoAtual.current)) {
      setError(MSG_SESSAO_MUDOU);
      return;
    }

    setSaving(true);
    try {
      const created = await api.post<SleepLog>('/sleep-logs', toApiPayload(form, fuso), { token });
      // A sessão trocou com o pedido em voo: o registro é de A, não desta tela.
      if (!sessaoDaTelaAindaVale(token, sessaoAtual.current)) return;
      setSuccess(`Noite registrada: ${formatDuration(created.sleepStart ?? '', created.sleepEnd ?? '')} de sono.`);
      applyDefaults();
      setQuality(0);
      setNotes('');
      await loadRecent();
    } catch (err: unknown) {
      if (sessaoDaTelaAindaVale(token, sessaoAtual.current)) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={telaStyle}>
      {/* Título da tela: o cabeçalho compartilhado mostra a saudação (#209). */}
      <header>
        <p className="overline" style={{ margin: '0 0 0.25rem' }}>
          Como foi a noite?
        </p>
        <h1 style={{ margin: 0 }} className="display-number display-sm">
          Registrar noite
        </h1>
      </header>

      {/* Duração ao vivo em destaque */}
      <Card style={duracaoCardStyle}>
        <p className="overline" style={{ margin: 0 }}>
          Duração
        </p>
        <p style={duracaoNumeroStyle}>{minutos === null ? '—' : formatarDuracaoLonga(minutos)}</p>
        <p style={duracaoLegendaStyle}>
          {porcentagem === null
            ? 'Preencha os horários para ver a duração'
            : `Meta de ${Math.round(metaMinutos / 60)}h · ${porcentagem}%`}
        </p>
      </Card>

      {/* Formulário: Enter nos campos também salva; o botão é type=submit */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSalvar();
        }}
        style={formStyle}
      >
        {/* Blocos grandes de horário: <label> envolvendo datetime-local real */}
        <div style={blocosGridStyle}>
          {(
            [
              { etiqueta: 'Dormiu às', valor: sleepStart, set: setSleepStart },
              { etiqueta: 'Acordou às', valor: sleepEnd, set: setSleepEnd },
            ] as const
          ).map(({ etiqueta, valor, set }) => (
            <label key={etiqueta} className="bloco-horario" style={blocoStyle}>
              <span className="overline">{etiqueta}</span>
              <span style={blocoHoraStyle}>{horaVisivel(valor)}</span>
              <span style={blocoLegendaStyle}>{valor ? rotuloDiaRelativo(dataVisivel(valor), hojeIso) : '—'}</span>
              <input
                type="datetime-local"
                aria-label={etiqueta}
                className="bloco-horario__input"
                value={valor}
                onChange={(e) => {
                  digitouRef.current = true;
                  set(e.target.value);
                }}
                required
              />
            </label>
          ))}
        </div>

        {/* Qualidade: radiogroup de cinco opções (selecionada em Âmbar) */}
        <QualitySelector value={quality} onChange={setQuality} legend="Qualidade do sono" errorId={error ? 'quality-error' : undefined} />

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          Observação (opcional)
          <textarea
            rows={3}
            maxLength={2000}
            placeholder="Ex.: acordei só uma vez"
            className="field"
            style={{ minHeight: '80px', resize: 'vertical' }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <Button type="submit" variant="primary" size="md" disabled={saving} style={{ width: '100%' }}>
          {saving ? 'Salvando…' : 'Salvar registro'}
        </Button>
      </form>

      {error && (
        <Card style={erroStyle}>
          <p role="alert" style={{ margin: 0, color: 'var(--color-erro-texto)' }}>
            {error}
          </p>
        </Card>
      )}
      {success && (
        <p role="status" style={{ color: 'var(--color-sucesso-texto)', margin: 0 }}>
          {success}
        </p>
      )}

      <section aria-label="Seus últimos registros" style={{ marginTop: '0.5rem' }}>
        <h2 style={{ fontSize: '18px' }}>Seus últimos registros</h2>
        {!recentLoaded && (
          <>
            <p>Carregando…</p>
            <LoadingWarning isLoading={true} />
          </>
        )}
        {recentLoaded && recent.length === 0 && (
          <p style={{ color: 'var(--text-muted)' }}>Nenhuma noite registrada ainda.</p>
        )}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {recent.map((log) => (
            <li key={log.id} style={recenteItemStyle}>
              <strong>
                {formatLocal(log.sleepStart ?? '', fuso)} → {formatLocal(log.sleepEnd ?? '', fuso)}
              </strong>{' '}
              · {formatDuration(log.sleepStart ?? '', log.sleepEnd ?? '')} · nota {log.quality}
              {log.notes && <div style={{ color: 'var(--text-muted)' }}>{log.notes}</div>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
