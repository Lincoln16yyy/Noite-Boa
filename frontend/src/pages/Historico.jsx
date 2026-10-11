import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import {
  formatDuration,
  formatLocal,
  toApiPayload,
  toLocalInput,
  validateSleepForm,
} from '../lib/sleep';
import LoadingWarning from '../components/LoadingWarning';
import QualitySelector from '../components/QualitySelector';

const PAGE_SIZE = 10;

const cardStyle = {
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: '10px',
  padding: '0.75rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

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

const smallButtonStyle = {
  minHeight: '44px',
  padding: '0 0.9rem',
  fontSize: '15px',
  borderRadius: '10px',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-secondary)',
  cursor: 'pointer',
};

export default function Historico() {
  const [page, setPage] = useState(0);
  const [logs, setLogs] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState({ sleepStart: '', sleepEnd: '', quality: 0, notes: '' });
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (p, signal) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get(`/sleep-logs?page=${p}&size=${PAGE_SIZE}`, { signal });
      const content = data.content ?? [];
      if (content.length === 0 && p > 0) {
        setPage(p - 1); // página ficou vazia após excluir: volta uma
        return;
      }
      setLogs(content);
      setTotalPages(data.totalPages ?? 0);
      setTotalElements(data.totalElements ?? 0);
    } catch (err) {
      if (err.name === 'AbortError') return; // ignora cancelamento
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(page, controller.signal);
    return () => controller.abort(); // cancela requisição anterior ao trocar de página
  }, [page, load]);

  function startEdit(log) {
    setEditingId(log.id);
    setEditError('');
    setConfirmId(null);
    setEdit({
      sleepStart: toLocalInput(new Date(log.sleepStart)),
      sleepEnd: toLocalInput(new Date(log.sleepEnd)),
      quality: log.quality,
      notes: log.notes ?? '',
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    setEditError('');
    const problem = validateSleepForm(edit);
    if (problem) {
      setEditError(problem);
      return;
    }
    setSavingEdit(true);
    try {
      await api.put(`/sleep-logs/${editingId}`, toApiPayload(edit));
      setEditingId(null);
      await load(page);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function remove(id) {
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/sleep-logs/${id}`);
      setConfirmId(null);
      await load(page);
    } catch (err) {
      setError(err.message);
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
                    {formatLocal(log.sleepStart)} → {formatLocal(log.sleepEnd)}
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
                      onChange={(e) => setEdit({ ...edit, sleepEnd: e.target.value })}
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
                      onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                    />
                  </label>
                  <QualitySelector
                    value={edit.quality}
                    onChange={(v) => setEdit({ ...edit, quality: v })}
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