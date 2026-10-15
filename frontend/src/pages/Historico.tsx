import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties, ChangeEvent, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Goal, SleepLog as SleepLogApi, SleepLogPage } from '../api/types';
import { useAuth } from '../context/AuthContext';
import {
  formatarDuracaoCurta,
  formatarHora,
  minutosDoRegistro,
  toApiPayload,
  toLocalInput,
  validateSleepForm,
} from '../lib/sleep';
import { isoDateNoFuso } from '../lib/fuso';
import { agruparPorSemana, rotuloNoite } from '../lib/historico';
import { normalizarMeta } from '../lib/hoje';
import LoadingWarning from '../components/LoadingWarning';
import QualitySelector from '../components/QualitySelector';
import { Button, Card, Field, IconButton, ProgressBar } from '../components/ui';
import { MoonIcon, PencilIcon, TrashIcon } from '../components/ui/icons';

/**
 * Histórico v2 (issue #213) — fiel a docs/design/mockups/historico.png.
 * Regras: seção 5 de docs/design/direcao-visual.md. Noites agrupadas por
 * semana ("Esta semana", "Semana passada", depois a data), cada cartão com
 * dia, intervalo, barra de duração contra a meta, duração e qualidade
 * (ponto colorido **e** texto).
 */

/** Uma noite no formato da tela (campos obrigatórios). */
interface SleepLog {
  id: string;
  sleepStart: string;
  sleepEnd: string;
  quality: number;
  notes?: string | null;
}

interface LocalDateTimeInput {
  sleepStart: string;
  sleepEnd: string;
}

const PAGE_SIZE = 10;

/** Cores da qualidade (seção 5 do guia) — nunca só cor: sempre com texto. */
const QUALIDADE: Record<number, { texto: string; cor: string }> = {
  1: { texto: 'Péssima', cor: 'var(--color-erro)' },
  2: { texto: 'Ruim', cor: 'var(--color-ambar)' },
  3: { texto: 'Ok', cor: 'var(--color-luar)' },
  4: { texto: 'Boa', cor: 'var(--color-lavanda)' },
  5: { texto: 'Ótima', cor: 'var(--color-sucesso)' },
};

const telaStyle: CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
};

const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  padding: '1rem',
};

const cartaoTopoStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '0.75rem',
};

const cartaoDiaStyle: CSSProperties = {
  fontSize: '17px',
  fontWeight: 700,
  color: 'var(--text-primary)',
};

const qualidadeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--text-secondary)',
};

const pontoStyle = (cor: string): CSSProperties => ({
  width: '10px',
  height: '10px',
  borderRadius: '50%',
  background: cor,
  // Borda sutil: no tema claro o ponto Luar/Âmbar precisa de contorno para
  // continuar visível (3:1 em elemento gráfico).
  border: '1px solid var(--surface-border)',
});

const intervaloStyle: CSSProperties = {
  fontSize: '14px',
  color: 'var(--text-secondary)',
};

const barraLinhaStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
};

const duracaoStyle: CSSProperties = {
  fontSize: '14px',
  fontWeight: 700,
  color: 'var(--text-primary)',
  fontVariantNumeric: 'tabular-nums',
  minWidth: '3.5rem',
  textAlign: 'right',
};

const acoesStyle: CSSProperties = {
  display: 'flex',
  gap: '0.25rem',
  alignItems: 'center',
};

const confirmacaoStyle: CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  alignItems: 'center',
  flexWrap: 'wrap',
};

const notasStyle: CSSProperties = {
  fontSize: '13px',
  color: 'var(--text-muted)',
};

const erroStyle: CSSProperties = { borderColor: 'var(--color-erro)' };

const grupoStyle: CSSProperties = { margin: '0.5rem 0 0' };

/** Converte o registro da API (campos opcionais) no formato da tela. */
function paraTela(log: SleepLogApi): SleepLog {
  return {
    id: log.id ?? '',
    sleepStart: log.sleepStart ?? '',
    sleepEnd: log.sleepEnd ?? '',
    quality: log.quality ?? 0,
    notes: log.notes ?? null,
  };
}

export default function Historico() {
  const { user } = useAuth();
  const fuso = user?.timezone; // fonte única: fuso do perfil (issue #102)
  const [page, setPage] = useState<number>(0);
  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [totalElements, setTotalElements] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [metaMinutos, setMetaMinutos] = useState<number>(480);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<{
    sleepStart: LocalDateTimeInput['sleepStart'];
    sleepEnd: LocalDateTimeInput['sleepEnd'];
    quality: number;
    notes: string;
  }>({ sleepStart: '', sleepEnd: '', quality: 0, notes: '' });
  const [editError, setEditError] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<SleepLogPage>(`/sleep-logs?page=${p}&size=${PAGE_SIZE}`);
      const content = (data.content ?? []).map(paraTela);
      if (content.length === 0 && p > 0) {
        setPage(p - 1); // página ficou vazia após excluir: volta uma
        return;
      }
      setLogs(content);
      setTotalPages(data.totalPages ?? 0);
      setTotalElements(data.totalElements ?? 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Meta para a barra de duração contra a meta (default 8h sem o /goal).
  useEffect(() => {
    api
      .get<Goal>('/goal')
      .then((goal) => setMetaMinutos(normalizarMeta(goal).minutos))
      .catch(() => setMetaMinutos(480));
  }, []);

  useEffect(() => {
    load(page);
  }, [page, load]);

  const hojeIso = isoDateNoFuso(new Date(), fuso ?? 'America/Sao_Paulo');
  const grupos = agruparPorSemana(logs, hojeIso, fuso ?? 'America/Sao_Paulo');

  function startEdit(log: SleepLog) {
    setEditingId(log.id);
    setEditError('');
    setConfirmId(null);
    setEdit({
      sleepStart: toLocalInput(new Date(log.sleepStart), fuso),
      sleepEnd: toLocalInput(new Date(log.sleepEnd), fuso),
      quality: log.quality,
      notes: log.notes ?? '',
    });
  }

  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEditError('');
    const problem = validateSleepForm(edit);
    if (problem) {
      setEditError(problem);
      return;
    }
    setSavingEdit(true);
    try {
      await api.put(`/sleep-logs/${editingId}`, toApiPayload(edit, fuso));
      setEditingId(null);
      await load(page);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setEditError(message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function remove(id: string) {
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/sleep-logs/${id}`);
      setConfirmId(null);
      await load(page);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={telaStyle}>
      {/* Título da tela: o cabeçalho compartilhado mostra a saudação (#209). */}
      <header>
        <p className="overline" style={{ margin: '0 0 0.25rem' }}>
          Suas noites
        </p>
        <h1 style={{ margin: 0 }} className="display-number display-sm">
          Histórico
        </h1>
      </header>

      {error && (
        <Card style={erroStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-start' }} role="alert">
            <p style={{ margin: 0, color: 'var(--color-erro-texto)' }}>{error}</p>
            <Button variant="secondary" onClick={() => load(page)}>
              Tentar novamente
            </Button>
          </div>
        </Card>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} aria-hidden="true">
          <div className="esqueleto" style={{ height: '128px', borderRadius: 'var(--surface-radius)' }} />
          <div className="esqueleto" style={{ height: '128px', borderRadius: 'var(--surface-radius)' }} />
          <div className="esqueleto" style={{ height: '128px', borderRadius: 'var(--surface-radius)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Carregando…</p>
          <LoadingWarning isLoading={true} />
        </div>
      )}

      {!loading && totalElements === 0 && (
        <Card style={{ ...cardStyle, alignItems: 'flex-start' }}>
          <MoonIcon size={40} />
          <p style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Você ainda não registrou nenhuma noite de sono.
          </p>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            Cada noite registrada aparece aqui, agrupada por semana, com a duração e a qualidade.
          </p>
          <Link to="/registrar" style={{ color: 'var(--accent)', fontWeight: 700 }}>
            Registrar a primeira noite →
          </Link>
        </Card>
      )}

      {!loading &&
        grupos.map((grupo) => (
          <section key={grupo.rotulo} aria-label={grupo.rotulo} style={grupoStyle}>
            <p className="overline" style={{ margin: '0 0 0.5rem' }}>
              {grupo.rotulo}
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {grupo.noites.map((log) => {
                const editing = editingId === log.id;
                const minutos = minutosDoRegistro(log.sleepStart, log.sleepEnd);
                const porcentagem = metaMinutos > 0 ? Math.min(100, Math.round((minutos / metaMinutos) * 100)) : 0;
                const qualidade = QUALIDADE[log.quality];
                const dataNoite = isoDateNoFuso(new Date(log.sleepStart), fuso ?? 'America/Sao_Paulo');
                return (
                  <li key={log.id}>
                    <Card style={cardStyle}>
                      {!editing && (
                        <>
                          <div style={cartaoTopoStyle}>
                            <span style={cartaoDiaStyle}>{rotuloNoite(dataNoite)}</span>
                            <span style={qualidadeStyle}>
                              <span style={pontoStyle(qualidade?.cor ?? 'var(--text-muted)')} aria-hidden="true" />
                              {qualidade?.texto ?? `Nota ${log.quality}`}
                            </span>
                          </div>
                          <span style={intervaloStyle}>
                            {formatarHora(log.sleepStart, fuso)} → {formatarHora(log.sleepEnd, fuso)}
                          </span>
                          <div style={barraLinhaStyle}>
                            <span style={{ flex: 1 }}>
                              <ProgressBar
                                value={porcentagem}
                                label={`Duração de ${formatarDuracaoCurta(minutos)}, ${porcentagem}% da meta de ${Math.round(metaMinutos / 60)}h`}
                                tone={minutos > 0 && minutos < metaMinutos ? 'below' : 'within'}
                              />
                            </span>
                            <span style={duracaoStyle}>{formatarDuracaoCurta(minutos)}</span>
                          </div>
                          {log.notes && <span style={notasStyle}>{log.notes}</span>}
                          <div style={acoesStyle}>
                            <IconButton aria-label="Editar" onClick={() => startEdit(log)}>
                              <PencilIcon />
                            </IconButton>
                            {confirmId === log.id ? (
                              <div style={confirmacaoStyle}>
                                <Button variant="danger" onClick={() => remove(log.id)} disabled={deleting}>
                                  {deleting ? 'Excluindo…' : 'Sim, excluir'}
                                </Button>
                                <Button variant="secondary" onClick={() => setConfirmId(null)}>
                                  Cancelar
                                </Button>
                              </div>
                            ) : (
                              <IconButton aria-label="Excluir" onClick={() => setConfirmId(log.id)}>
                                <TrashIcon />
                              </IconButton>
                            )}
                          </div>
                        </>
                      )}

                      {editing && (
                        <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                          <Field
                            label="Dormiu às"
                            type="datetime-local"
                            value={edit.sleepStart}
                            onChange={(e) => setEdit({ ...edit, sleepStart: e.target.value })}
                            required
                          />
                          <Field
                            label="Acordou às"
                            type="datetime-local"
                            value={edit.sleepEnd}
                            onChange={(e) => setEdit({ ...edit, sleepEnd: e.target.value })}
                            required
                          />
                          <label className="ui-field">
                            Observação (opcional)
                            <textarea
                              className="field"
                              rows={2}
                              maxLength={2000}
                              style={{ minHeight: '64px', resize: 'vertical' }}
                              value={edit.notes}
                              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setEdit({ ...edit, notes: e.target.value })}
                            />
                          </label>
                          <QualitySelector
                            value={edit.quality}
                            onChange={(v: number) => setEdit({ ...edit, quality: v })}
                            disabled={savingEdit}
                            legend="Qualidade"
                            errorId={editError ? 'edit-error' : undefined}
                          />
                          {editError && (
                            <p role="alert" style={{ color: 'var(--color-erro-texto)', margin: 0 }}>
                              {editError}
                            </p>
                          )}
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <Button type="submit" variant="primary" loading={savingEdit}>
                              {savingEdit ? 'Salvando…' : 'Salvar'}
                            </Button>
                            <Button variant="secondary" onClick={() => setEditingId(null)}>
                              Cancelar
                            </Button>
                          </div>
                        </form>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

      {!loading && totalElements > 0 && (
        <nav aria-label="Paginação" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
          <Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <span style={{ color: 'var(--text-muted)' }}>
            Página {page + 1} de {Math.max(totalPages, 1)} · {totalElements} noite{totalElements === 1 ? '' : 's'}
          </span>
          <Button variant="secondary" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>
            Próxima
          </Button>
        </nav>
      )}
    </div>
  );
}
