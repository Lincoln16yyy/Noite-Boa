import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearSession } from '../api/client';
import {
  agendarLembrete,
  cancelarLembrete,
  lembreteAtivo,
  permissaoNotificacao,
  setLembreteAtivo as salvarLembrete,
  suportaNotificacao,
} from '../lib/reminder';
import LoadingWarning from '../components/LoadingWarning';

const TIMEZONES =
  typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : ['America/Sao_Paulo', 'America/New_York', 'Europe/Lisbon', 'UTC'];

const fieldStyle = {
  width: '100%',
  minHeight: '48px',
  fontSize: '16px',
  padding: '0.6rem 0.75rem',
  border: '1px solid #C9C6F0',
  borderRadius: '10px',
  background: '#FFFFFF',
  boxSizing: 'border-box',
};

const buttonStyle = {
  minHeight: '48px',
  fontSize: '16px',
  fontWeight: 700,
  borderRadius: '10px',
  border: 'none',
  background: '#15142E',
  color: '#FFE9B5',
  cursor: 'pointer',
  width: '100%',
};

/** "23:00:00" (LocalTime da API) → "23:00" (input type=time) */
const toTimeInput = (value) => (value ? String(value).slice(0, 5) : '');

export default function Configuracoes() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
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

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [meData, goalData] = await Promise.all([api.get('/me'), api.get('/goal')]);
        if (!active) return;
        setMe(meData);
        setHours(String(goalData.targetMinutes / 60));
        setBedtime(toTimeInput(goalData.bedtime));
        setWakeTime(toTimeInput(goalData.wakeTime));
        setTimezone(meData.timezone || 'America/Sao_Paulo');
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e) {
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
        updatedMe = await api.put('/me', { timezone });
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
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    clearSession();
    navigate('/login');
  }

  /** Ativa/desativa o lembrete. A permissão só é pedida aqui, com clique explícito. */
  async function alternarLembrete(e) {
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
    <div style={{ maxWidth: '480px' }}>
      <h1>Configurações</h1>

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ fontSize: '18px', fontWeight: 700, marginBottom: '0.6rem' }}>Meta de sono</legend>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            Horas por noite (4 a 12)
            <input
              type="number"
              min={4}
              max={12}
              step={0.5}
              style={fieldStyle}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              required
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              Horário de dormir
              <input type="time" style={fieldStyle} value={bedtime} onChange={(e) => setBedtime(e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              Horário de acordar
              <input type="time" style={fieldStyle} value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} />
            </label>
          </div>
        </fieldset>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          Fuso horário
          <select style={fieldStyle} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" style={buttonStyle} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </form>

      {error && (
        <div role="alert" style={{ ...buttonStyle, background: '#FDE8E8', border: '1px solid #F5B8B8', color: 'var(--color-erro-texto)', textAlign: 'left', marginTop: '0.5rem' }}>
          <p style={{ marginTop: 0 }}>{error}</p>
          <button type="button" style={{ ...buttonStyle, background: '#15142E', color: '#FFE9B5', border: 'none', marginTop: '0.5rem' }} onClick={() => window.location.reload()}>
            Tentar novamente
          </button>
        </div>
      )}
      {success && (
        <p role="status" style={{ color: 'var(--color-sucesso-texto)' }}>
          {success}
        </p>
      )}

      <section aria-label="Lembrete de dormir" style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '18px' }}>Lembrete de dormir</h2>
        <p style={{ color: '#4B4A6B', marginTop: 0, fontSize: '15px' }}>
          Com o app aberto (aba no navegador ou instalado), avisamos você no seu horário de dormir.{' '}
          <strong>Não é um alarme:</strong> navegadores não garantem notificação com o app fechado, e o suporte é
          irregular no celular. A preferência fica guardada apenas neste dispositivo.
        </p>

        {permissaoNotificacao() === 'denied' && (
          <p style={{ color: '#4B4A6B', fontSize: '15px' }}>
            Notificações estão bloqueadas para este site — libere nas permissões do navegador para ativar o lembrete.
          </p>
        )}
        {!suportaNotificacao() && (
          <p style={{ color: '#4B4A6B', fontSize: '15px' }}>Este navegador não suporta notificações.</p>
        )}

        {bedtime ? (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              minHeight: '44px',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={lembrete}
              onChange={alternarLembrete}
              style={{ width: '24px', height: '24px', accentColor: '#15142E' }}
            />
            Avisar às {bedtime}
          </label>
        ) : (
          <p style={{ color: '#4B4A6B', fontSize: '15px' }}>
            Defina o “Horário de dormir” na meta para usar o lembrete.
          </p>
        )}

        {msgLembrete && (
          <p role="status" style={{ color: '#4B4A6B', fontSize: '15px' }}>
            {msgLembrete}
          </p>
        )}
      </section>

      <section aria-label="Conta" style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '18px' }}>Conta</h2>
        {me && (
          <p style={{ color: '#4B4A6B', marginTop: 0 }}>
            {me.displayName} · {me.email}
          </p>
        )}
        <button
          type="button"
          onClick={handleLogout}
          style={{ ...buttonStyle, background: '#FFFFFF', color: '#15142E', border: '1px solid #C9C6F0' }}
        >
          Sair da conta
        </button>
      </section>
    </div>
  );
}
