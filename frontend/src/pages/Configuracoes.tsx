import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearSession } from '../api/client';
import type { Goal, User } from '../api/types';
import {
  agendarLembrete,
  cancelarLembrete,
  lembreteAtivo,
  permissaoNotificacao,
  setLembreteAtivo as salvarLembrete,
  suportaNotificacao,
} from '../lib/reminder';
import { useTheme } from '../context/ThemeContext';
import { fusoDoAparelho } from '../lib/fuso';
import LoadingWarning from '../components/LoadingWarning';
import { Chip } from '../components/ui';

const TIMEZONES =
  typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : ['America/Sao_Paulo', 'America/New_York', 'Europe/Lisbon', 'UTC'];

/** "23:00:00" (LocalTime da API) → "23:00" (input type=time) */
const toTimeInput = (value?: string | null) => (value ? String(value).slice(0, 5) : '');

export default function Configuracoes() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const fusoAparelho = fusoDoAparelho();
  const [me, setMe] = useState<User | null>(null);
  const [hours, setHours] = useState('');
  const [bedtime, setBedtime] = useState('');
  const [wakeTime, setWakeTime] = useState('');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lembrete, setLembre] = useState(lembreteAtivo());
  const [msgLembrete, setMsgLembrete] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [meData, goalData] = await Promise.all([
          api.get<User>('/me'),
          api.get<Goal>('/goal'),
        ]);
        if (!active) return;
        setMe(meData);
        setHours(String((goalData.targetMinutes ?? 0) / 60));
        setBedtime(toTimeInput(goalData.bedtime));
        setWakeTime(toTimeInput(goalData.wakeTime));
        setTimezone(meData.timezone || 'America/Sao_Paulo');
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const minutes = Math.round(Number(hours) * 60);
    if (!hours || Number.isNaN(minutes) || minutes < 240 || minutes > 720) {
      setError('A meta deve ficar entre 4 e 12 horas por noite.');
      return;
    }

    setSaving(true);
    try {
      let updatedMe = me;
      if (me && timezone !== me.timezone) {
        updatedMe = await api.put<User>('/me', { timezone });
      }
      await api.put('/goal', {
        targetMinutes: minutes,
        bedtime: bedtime || null,
        wakeTime: wakeTime || null,
      });
      setMe(updatedMe);
      setSuccess('Preferências salvas.');

      // o lembrete segue o horário de dormir: reagenda com o valor salvo
      // (e cancela se o horário foi removido — a preferência fica guardada
      // e volta a valer quando houver um horário novo)
      if (lembreteAtivo()) {
        if (bedtime) agendarLembrete(bedtime);
        else cancelarLembrete();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  /** Aviso de fuso diferente (issue #102): alinha o perfil ao do aparelho. */
  async function atualizarFusoDoAparelho() {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const updatedMe = await api.put<User>('/me', { timezone: fusoAparelho });
      setMe(updatedMe);
      setTimezone(updatedMe.timezone ?? 'America/Sao_Paulo');
      setSuccess('Fuso horário atualizado para o do aparelho.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    clearSession();
    navigate('/login');
  }

  async function handleDeleteAccount() {
    const email = me?.email;
    const confirmation = deleteConfirm.trim();

    setDeleteError('');
    if (!email || (confirmation !== email && confirmation !== 'EXCLUIR')) {
      setDeleteError('Digite seu e-mail ou "EXCLUIR" para confirmar.');
      return;
    }

    setDeleting(true);
    setError('');
    setSuccess('');

    try {
      await api.delete('/me');
      clearSession();
      // Avisa o AuthProvider para derrubar o usuário da sessão
      window.dispatchEvent(new CustomEvent('noiteboa:session-change'));
      navigate('/?deleted=true');
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  }

  /** Ativa/desativa o lembrete. A permissão só é pedida aqui, com clique explícito. */
  async function alternarLembrete(e: ChangeEvent<HTMLInputElement>) {
    const querAtivar = e.target.checked;
    setMsgLembrete('');
    if (!querAtivar) {
      salvarLembrete(false);
      cancelarLembrete();
      setLembre(false);
      return;
    }
    if (!suportaNotificacao()) {
      setMsgLembrete('Este navegador não suporta notificações.');
      return;
    }
    if (permissaoNotificacao() !== 'granted') {
      const permissao = await window.Notification.requestPermission();
      if (permissao !== 'granted') {
        setMsgLembrete('Notificação bloqueada. Libere as notificações deste site nas permissões do navegador.');
        return;
      }
    }
    salvarLembrete(true);
    agendarLembrete(bedtime);
    setLembre(true);
    setMsgLembrete(`Lembrete armado para ${bedtime}, enquanto o app estiver aberto.`);
  }

  if (loading) return (
    <>
      <p>Carregando…</p>
      <LoadingWarning isLoading={true} />
    </>
  );

  return (
    <div className="container">
      <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '1.5rem' }}>Configurações</h1>

      <form onSubmit={handleSubmit} noValidate className="form">
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ fontSize: '18px', fontWeight: 700, marginBottom: '0.6rem' }}>Meta de sono</legend>

          <label className="label">
            Horas por noite (4 a 12)
            <input
              type="number"
              min={4}
              max={12}
              step={0.5}
              className="field"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              required
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
            <label className="label">
              Horário de dormir
              <input type="time" className="field" value={bedtime} onChange={(e) => setBedtime(e.target.value)} />
            </label>
            <label className="label">
              Horário de acordar
              <input type="time" className="field" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} />
            </label>
          </div>
        </fieldset>

        <label className="label">
          Fuso horário
          <select className="field" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </label>

        {me && me.timezone && fusoAparelho && fusoAparelho !== me.timezone && (
          <div
            role="status"
            style={{
              border: '1px solid var(--card-border)',
              borderRadius: '10px',
              padding: '0.75rem',
              marginTop: '0.5rem',
              color: 'var(--text-muted)',
              fontSize: '15px',
            }}
          >
            <p style={{ marginTop: 0 }}>
              Este aparelho está em <strong>{fusoAparelho}</strong>, mas seu perfil usa{' '}
              <strong>{me.timezone}</strong> — dias e estatísticas seguem o fuso do perfil.
            </p>
            <button type="button" className="btn" onClick={atualizarFusoDoAparelho} disabled={saving}>
              {saving ? 'Salvando…' : `Usar o fuso do aparelho (${fusoAparelho})`}
            </button>
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </form>

      {error && (
        <div role="alert" className="alert alert-error">
          <p style={{ marginTop: 0 }}>{error}</p>
          <button type="button" className="btn btn-primary" style={{ marginTop: '0.5rem' }} onClick={() => window.location.reload()}>
            Tentar novamente
          </button>
        </div>
      )}
      {success && (
        <p role="status" className="alert alert-success">{success}</p>
      )}

      <section aria-label="Lembrete de dormir" style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '0.5rem' }}>Lembrete de dormir</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: 0, fontSize: '15px' }}>
          Com o app aberto (aba no navegador ou instalado), avisamos você no seu horário de dormir.{' '}
          <strong>Não é um alarme:</strong> navegadores não garantem notificação com o app fechado, e o suporte é
          irregular no celular. A preferência fica guardada apenas neste dispositivo.
        </p>

        {permissaoNotificacao() === 'denied' && (
          <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>
            Notificações estão bloqueadas para este site — libere nas permissões do navegador para ativar o lembrete.
          </p>
        )}
        {!suportaNotificacao() && (
          <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Este navegador não suporta notificações.</p>
        )}

        {bedtime ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minHeight: '44px', fontSize: '16px', fontWeight: 700, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={lembrete}
              onChange={alternarLembrete}
              style={{ width: '24px', height: '24px', accentColor: 'var(--color-ambar)' }}
            />
            Avisar às {bedtime}
          </label>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>
            Defina o “Horário de dormir” na meta para usar o lembrete.
          </p>
        )}

        {msgLembrete && (
          <p role="status" style={{ color: 'var(--text-muted)', fontSize: '15px' }}>
            {msgLembrete}
          </p>
        )}
      </section>

      <section aria-label="Tema" style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '0.5rem' }}>Tema</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: 0, fontSize: '15px', marginBottom: '0.75rem' }}>
          Escolha a aparência do app. No modo automático, segue a preferência do sistema.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Chip
            selected={theme === 'light'}
            onClick={() => setTheme('light')}
            style={{ flex: '1 1 auto', minWidth: 'fit-content', whiteSpace: 'nowrap' }}
          >
            Claro
          </Chip>
          <Chip
            selected={theme === 'dark'}
            onClick={() => setTheme('dark')}
            style={{ flex: '1 1 auto', minWidth: 'fit-content', whiteSpace: 'nowrap' }}
          >
            Escuro
          </Chip>
          <Chip
            selected={theme === 'auto'}
            onClick={() => setTheme('auto')}
            style={{ flex: '1 1 auto', minWidth: 'fit-content', whiteSpace: 'nowrap' }}
          >
            Automático
          </Chip>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '0.5rem' }}>
          Atual: {theme === 'light' ? 'Claro' : theme === 'dark' ? 'Escuro' : 'Automático'}
        </p>
      </section>

      <section aria-label="Conta" style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '0.5rem' }}>Conta</h2>
        {me && (
          <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
            {me.displayName} · {me.email}
          </p>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="btn btn-ghost"
          style={{ width: '100%' }}
        >
          Sair da conta
        </button>
      </section>

      <section aria-label="Excluir conta" style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-erro)' }}>Excluir conta</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: 0, fontSize: '15px', marginBottom: '0.75rem' }}>
          Esta ação é <strong>irreversível</strong>. Todos os seus registros de sono, metas, amigos e preferências serão
          apagados permanentemente. Não é possível desfazer.
        </p>
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span>
              Digite seu e-mail ou <strong>EXCLUIR</strong> para confirmar
            </span>
            <input
              type="text"
              className="field"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="seu@email.com ou EXCLUIR"
              autoComplete="email"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={handleDeleteAccount}
          disabled={!deleteConfirm.trim() || deleting}
          className="btn btn-danger"
          style={{ width: '100%' }}
        >
          {deleting ? 'Excluindo…' : 'Excluir minha conta'}
        </button>
        {deleteError && (
          <p role="alert" className="alert alert-error" style={{ marginTop: '0.75rem' }}>
            {deleteError}
          </p>
        )}
      </section>
    </div>
  );
}
