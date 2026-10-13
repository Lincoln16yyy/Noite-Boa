import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent, CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  formatDuration,
  formatLocal,
  toApiPayload,
  toLocalInput,
  validateSleepForm,
} from '../lib/sleep';
import LoadingWarning from '../components/LoadingWarning';
import QualitySelector from '../components/QualitySelector';

export type ISODateTime = string;
export type LocalDateTimeInput = string;

export interface SleepLog {
  id: string;
  sleepStart: ISODateTime;
  sleepEnd: ISODateTime;
  quality: 1 | 2 | 3 | 4 | 5;
  notes?: string | null;
}

const PAGE_SIZE = 10;

const cardStyle: CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: '10px',
  padding: '0.75rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const fieldStyle: CSSProperties = {
  width: '100%',
  minHeight: '48px',
  fontSize: '16px',
  padding: '0.6rem 0.75rem',
  border: '1px solid var(--input-border)',
  borderRadius: '10px',
  background: 'var(--input-bg)',
  boxSizing: 'border-box',
};

const smallButtonStyle: CSSProperties = {
  minHeight: '44px',
  padding: '0 0.9rem',
  fontSize: '15px',
  borderRadius: '10px',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-secondary)',
  cursor: 'pointer',
};

export default function Historico() {
  const { user } = useAuth();
  const fuso = user?.timezone; // fonte única: fuso do perfil (issue #102)
  const [page, setPage] = useState<number>(0);
  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [totalElements, setTotalElements] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<{
    sleepStart: LocalDateTimeInput;
    sleepEnd: LocalDateTimeInput;
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
      const data: any = await api.get(`/sleep-logs?page=${p}&size=${PAGE_SIZE}`);
      const content = data.content ?? [];
      if (content.length === 0 && p > 0) {
        setPage(p - 1); // página ficou vazia após excluir: volta uma
        return;
      }
      setLogs(content);
      setTotalPages(data.totalPages ?? 0);
      setTotalElements(data.totalElements ?? 0);
    } catch (err: any) {
      if (err.name === 'AbortError') return; // ignora cancelamento
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page);
    // Note: sem AbortController pois a API não suporta cancelamento nativo ainda
    // TODO: adicionar suporte a AbortSignal na API quando necessário
  }, [page, load]);

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
    } catch (err: any) {
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
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{ maxWidth: '560px' }}>
      <h1>Histórico</h1>

      {error && (
        <div role="alert" style={{ ...cardStyle, borderColor: 'var(--color-erro)', marginBottom: '0.75rem' }}>
          <p style={{ marginTop: 0, color: 'var(--color-erro-texto)' }}>{error}</p>
          <button type="button" style={smallButtonStyle} onClick={() => load(page)}>
            Tentar novamente
          </button>
        </div>
      )}

      {loading && (
        <>
          <p>Carregando…</p>
          <LoadingWarning isLoading={true} />
        </>
      )}

      {!loading && totalElements === 0 && (
        <div style={{ ...cardStyle, alignItems: 'flex-start' }}>
          <p style={{ margin: 0 }}>Você ainda não registrou nenhuma noite de sono.</p>
          <Link to="/registrar" style={{ color: 'var(--color-ambar)', fontWeight: 700 }}>
            Registrar a primeira noite →
          </Link>
        </div>
      )}

      {!loading && (
        <ul
          aria-label="Noites registradas"
          style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
        >
        {logs.map((log) => {
          const editing = editingId === log.id;
          return (
            <li key={log.id} style={cardStyle}>
              {!editing && (
                <>
                  <strong>
                    {formatLocal(log.sleepStart, fuso)} → {formatLocal(log.sleepEnd, fuso)}
                  </strong>{' '}
                  <span>
                    {formatDuration(log.sleepStart, log.sleepEnd)} · nota {log.quality}
                  </span>
                  {log.notes && <span style={{ color: 'var(--text-muted)' }}>{log.notes}</span>}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button type="button" style={smallButtonStyle} onClick={() => startEdit(log)}>
                      Editar
                    </button>
                    {confirmId === log.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => remove(log.id)}
                          disabled={deleting}
                          style={{
                            ...smallButtonStyle,
                            background: 'var(--color-erro-texto)',
                            color: '#FFFFFF',
                            border: 'none',
                          }}
                        >
                          {deleting ? 'Excluindo…' : 'Sim, excluir'}
                        </button>
                        <button type="button" style={smallButtonStyle} onClick={() => setConfirmId(null)}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button type="button" style={smallButtonStyle} onClick={() => setConfirmId(log.id)}>
                        Excluir
                      </button>
                    )}
                  </div>
                </>
              )}

              {editing && (
                <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    Dormiu às
                    <input
                      type="datetime-local"
                      style={fieldStyle}
                      value={edit.sleepStart}
                      onChange={(e) => setEdit({ ...edit, sleepStart: e.target.value })}
                      required
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    Acordou às
                    <input
                      type="datetime-local"
                      style={fieldStyle}
                      value={edit.sleepEnd}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setEdit({ ...edit, sleepEnd: e.target.value })}
                      required
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    Observação (opcional)
                    <textarea
                      rows={2}
                      maxLength={2000}
                      style={{ ...fieldStyle, minHeight: '64px', resize: 'vertical' }}
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
                    <button
                      type="submit"
                      disabled={savingEdit}
                      style={{
                        ...smallButtonStyle,
                        background: 'var(--color-noite)',
                        color: 'var(--color-luar)',
                        border: 'none',
                        fontWeight: 700,
                      }}
                    >
                      {savingEdit ? 'Salvando…' : 'Salvar'}
                    </button>
                    <button type="button" style={smallButtonStyle} onClick={() => setEditingId(null)}>
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </li>
          );
        })}
        </ul>
      )}

      {!loading && totalElements > 0 && (
        <nav aria-label="Paginação" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1rem' }}>
          <button
            type="button"
            style={{ ...smallButtonStyle, opacity: page === 0 ? 0.5 : 1 }}
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </button>
          <span style={{ color: 'var(--text-muted)' }}>
            Página {page + 1} de {Math.max(totalPages, 1)} · {totalElements} noite{totalElements === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            style={{ ...smallButtonStyle, opacity: page + 1 >= totalPages ? 0.5 : 1 }}
            disabled={page + 1 >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Próxima
          </button>
        </nav>
      )}
    </div>
  );
}