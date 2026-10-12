import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, CSSProperties } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  formatDuration,
  formatLocal,
  smartDefaults,
  toApiPayload,
  validateSleepForm,
} from '../lib/sleep';
import LoadingWarning from '../components/LoadingWarning';
import QualitySelector from '../components/QualitySelector';

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

export default function Registrar() {
  const { user } = useAuth();
  const fuso = user?.timezone; // fonte única: fuso do perfil (issue #102)
  const [sleepStart, setSleepStart] = useState<string>('');
  const [sleepEnd, setSleepEnd] = useState<string>('');
  const [quality, setQuality] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [recent, setRecent] = useState<any[]>([]);
  const [recentLoaded, setRecentLoaded] = useState<boolean>(false);
  const digitouRef = useRef(false); // não repor o digitado quando o fuso do perfil chegar (#102)

  const applyDefaults = useCallback(() => {
    const defaults = smartDefaults(new Date(), fuso);
    setSleepStart(defaults.sleepStart);
    setSleepEnd(defaults.sleepEnd);
  }, [fuso]);

  const loadRecent = useCallback(async () => {
    try {
      const page: any = await api.get('/sleep-logs?page=0&size=5');
      setRecent(page.content ?? []);
    } catch {
      setRecent([]);
    } finally {
      setRecentLoaded(true);
    }
  }, []);

  // Padrões com o fuso do perfil assim que ele chegar (o /me é assíncrono);
  // quem já digitou um horário não tem o campo reposto no meio da edição.
  useEffect(() => {
    if (!digitouRef.current) applyDefaults();
  }, [applyDefaults]);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return; // guarda extra contra duplo envio (#99)
    setError('');
    setSuccess('');

    const form = { sleepStart, sleepEnd, quality, notes };
    const problem = validateSleepForm(form);
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    try {
      const created: any = await api.post('/sleep-logs', toApiPayload(form, fuso));
      setSuccess(`Noite registrada: ${formatDuration(created.sleepStart, created.sleepEnd)} de sono.`);
      applyDefaults();
      setQuality(0);
      setNotes('');
      await loadRecent();
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: '480px' }}>
      <h1>Registrar noite</h1>
      <p style={{ color: 'var(--text-muted)' }}>
        Preencha quando você dormiu e acordou. Já deixamos os horários padrão: ontem à noite e hoje de manhã.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          Dormiu às
          <input
            type="datetime-local"
            className="field"
            value={sleepStart}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              digitouRef.current = true;
              setSleepStart(e.target.value);
            }}
            required
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          Acordou às
          <input
            type="datetime-local"
            className="field"
            value={sleepEnd}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              digitouRef.current = true;
              setSleepEnd(e.target.value);
            }}
            required
          />
        </label>

        <QualitySelector value={quality} onChange={setQuality} errorId={error ? 'quality-error' : undefined} />

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          Observação (opcional)
          <textarea
            rows={3}
            maxLength={2000}
            placeholder="Ex.: acordei várias vezes"
            style={{ ...fieldStyle, minHeight: '80px', resize: 'vertical' } as CSSProperties}
            value={notes}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
          />
        </label>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving}
          style={{ minHeight: '52px', fontSize: '1.06rem' }}
        >
          {saving ? 'Salvando…' : 'Salvar registro'}
        </button>
      </form>

      {error && (
        <p role="alert" style={{ color: 'var(--color-erro-texto)' }}>
          {error}
        </p>
      )}
      {success && (
        <p role="status" style={{ color: 'var(--color-sucesso-texto)' }}>
          {success}
        </p>
      )}

      <section aria-label="Seus últimos registros" style={{ marginTop: '1.5rem' }}>
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
            <li
              key={log.id}
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: '10px',
                padding: '0.6rem 0.75rem',
              }}
            >
              <strong>
                {formatLocal(log.sleepStart, fuso)} → {formatLocal(log.sleepEnd, fuso)}
              </strong>{' '}
              · {formatDuration(log.sleepStart, log.sleepEnd)} · nota {log.quality}
              {log.notes && <div style={{ color: 'var(--text-muted)' }}>{log.notes}</div>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}