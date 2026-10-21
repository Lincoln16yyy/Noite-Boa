import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Goal, GoalInput } from '../api/types';
import { MSG_SESSAO_MUDOU, sessaoDaTelaAindaVale } from '../lib/sessao-da-tela';
import { marcarOnboardingConcluido } from '../lib/primeiro-uso';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Field, ProgressBar } from '../components/ui';

/**
 * Primeiro uso em 3 passos (issue #215).
 *
 * Sem mockup próprio: o visual segue docs/design/direcao-visual.md — tokens,
 * componentes base da seção 4 e regras de copy da seção 7.
 *
 * Regras do fluxo:
 * - Salva com `PUT /goal`; pular nunca trava o caminho até a Hoje.
 * - O passo 1 é a única coisa que o `PUT` exige (`targetMinutes` é obrigatório
 *   na API), então "Agora não" no passo 1 encerra o fluxo sem salvar nada —
 *   não há como enviar só o horário de dormir.
 * - O passo 3 só explica: não é alarme, e o lembrete real (que só dispara com
 *   o app aberto) é ligado em Configurações, com clique e permissão
 *   explícitos (lib/reminder.ts). Nada é persistido aqui.
 * - Foco vai para o título a cada passo, para o leitor de tela acompanhar.
 */

const TOTAL_PASSOS = 3;
const MIN_HORAS = 4;
const MAX_HORAS = 12;
const HORAS_PADRAO = 8;

const telaStyle = {
  maxWidth: '480px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '1rem',
};

const numeroStyle = {
  margin: 0,
  fontSize: 'var(--fs-display-lg)',
  fontWeight: 800,
  lineHeight: 1,
  color: 'var(--text-primary)',
  fontVariantNumeric: 'tabular-nums' as const,
  textAlign: 'center' as const,
};

const acoesStyle = {
  display: 'flex',
  gap: '0.5rem',
  alignItems: 'center',
};

/**
 * Raio no título: o foco vai para ele a cada passo e a regra global de
 * `:focus-visible` desenha o anel com esse raio — sem isso o anel fica com
 * aresta viva e parece um defeito de layout em vez de indicador de foco.
 */
const tituloStyle = {
  margin: '0 0 0.5rem',
  borderRadius: '6px',
};

export default function Onboarding() {
  const navigate = useNavigate();
  const { sessao } = useAuth();
  // Sessão atual do contexto para as checagens espalhadas por callbacks.
  const sessaoAtual = useRef(sessao);
  sessaoAtual.current = sessao;
  const [passo, setPasso] = useState(1);
  const [horas, setHoras] = useState(HORAS_PADRAO);
  const [dormir, setDormir] = useState('');
  const [acordar, setAcordar] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  // Sessão que abriu o primeiro uso: o que foi escolhido para A não pode ser
  // gravado em B se o contexto trocar de conta com a tela montada (#298).
  const tokenDaTela = useRef<string | null>(sessao);
  // Troca de sessão: o primeiro uso recomeça do zero para a conta nova, sem
  // horas/horários escolhidos para a anterior (#298).
  useEffect(() => {
    setPasso(1);
    setHoras(HORAS_PADRAO);
    setDormir('');
    setAcordar('');
    setErro('');
    // Só a troca de sessão deve reiniciar o fluxo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao]);

  // Foco no título do passo a cada avanço (acessibilidade, issue #215).
  useEffect(() => {
    tituloRef.current?.focus();
  }, [passo]);

  function concluir() {
    // O marcador é do aparelho: uma tela da conta antiga não pode "concluir"
    // o primeiro uso da conta que entrou depois (#298).
    if (!sessaoDaTelaAindaVale(tokenDaTela.current, sessaoAtual.current)) {
      setErro(MSG_SESSAO_MUDOU);
      return;
    }
    marcarOnboardingConcluido();
    navigate('/hoje', { replace: true });
  }

  /** Envia o que foi escolhido até aqui. `false` = mantém no passo com o erro. */
  async function salvar(envio: Partial<GoalInput>): Promise<boolean> {
    const token = tokenDaTela.current;
    if (!sessaoDaTelaAindaVale(token, sessaoAtual.current)) {
      setErro(MSG_SESSAO_MUDOU);
      return false;
    }
    setSalvando(true);
    try {
      await api.put<Goal>('/goal', envio, { token });
      // A sessão trocou com o pedido em voo: o /goal é de A, não avance a
      // tela da conta nova (#298).
      if (!sessaoDaTelaAindaVale(token, sessaoAtual.current)) {
        setErro(MSG_SESSAO_MUDOU);
        return false;
      }
      return true;
    } catch (err: unknown) {
      // Erro de um PUT da conta anterior não aparece na tela da nova (#298).
      if (sessaoDaTelaAindaVale(token, sessaoAtual.current)) {
        setErro(err instanceof Error ? err.message : String(err));
      }
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function avancar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (salvando) return;
    setErro('');

    if (passo === TOTAL_PASSOS) {
      concluir();
      return;
    }

    // Só o passo 1 grava sozinho; o passo 2 reenvia as horas junto, porque a
    // API exige targetMinutes em todo PUT. Horário em branco é omitido do
    // corpo (o backend trata como "sem horário", igual a null).
    const envio: Partial<GoalInput> =
      passo === 1
        ? { targetMinutes: horas * 60 }
        : { targetMinutes: horas * 60, bedtime: dormir || undefined, wakeTime: acordar || undefined };

    if (await salvar(envio)) setPasso(passo + 1);
  }

  /** Pular não salva o passo atual: no 1 encerra o fluxo, no 2 vai ao 3. */
  function pular() {
    setErro('');
    if (passo === 1) concluir();
    else setPasso(passo + 1);
  }

  return (
    <div style={telaStyle}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <p className="overline" style={{ margin: 0 }}>
          Passo {passo} de {TOTAL_PASSOS}
        </p>
        <ProgressBar value={(passo / TOTAL_PASSOS) * 100} label={`Progresso do primeiro uso: passo ${passo} de ${TOTAL_PASSOS}`} />
      </header>

      <form onSubmit={(e) => void avancar(e)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {passo === 1 && (
          <section aria-labelledby="onboarding-titulo">
            <h1 id="onboarding-titulo" tabIndex={-1} ref={tituloRef} style={tituloStyle} className="display-sm">
              Quanto você quer dormir por noite?
            </h1>
            <p style={{ margin: '0 0 1rem', color: 'var(--text-secondary)' }}>
              De {MIN_HORAS} a {MAX_HORAS} horas. Serve para mostrar seu progresso, sem cobrança.
            </p>

            <Card style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center', padding: '1.25rem' }}>
              <p style={numeroStyle}>{horas}h</p>
              <input
                type="range"
                min={MIN_HORAS}
                max={MAX_HORAS}
                step={1}
                value={horas}
                onChange={(e) => setHoras(Number(e.target.value))}
                aria-label="Meta de horas por noite"
                aria-valuetext={`${horas} horas`}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                De {MIN_HORAS}h a {MAX_HORAS}h · você ajusta quando quiser em Configurações
              </p>
            </Card>
          </section>
        )}

        {passo === 2 && (
          <section aria-labelledby="onboarding-titulo">
            <h1 id="onboarding-titulo" tabIndex={-1} ref={tituloRef} style={tituloStyle} className="display-sm">
              Qual é o seu horário?
            </h1>
            <p style={{ margin: '0 0 1rem', color: 'var(--text-secondary)' }}>
              Usamos isso para contar quanto tempo falta até a hora de dormir e medir sua constância.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Field label="Hora de dormir" type="time" value={dormir} onChange={(e) => setDormir(e.target.value)} />
              <Field label="Hora de acordar" type="time" value={acordar} onChange={(e) => setAcordar(e.target.value)} />
            </div>
            <p style={{ margin: '0.5rem 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Opcional: pode deixar em branco.</p>
          </section>
        )}

        {passo === 3 && (
          <section aria-labelledby="onboarding-titulo">
            <h1 id="onboarding-titulo" tabIndex={-1} ref={tituloRef} style={tituloStyle} className="display-sm">
              Sobre lembretes
            </h1>

            <Card style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ margin: 0 }}>
                O Noite Boa <strong>não é um alarme</strong>: ele não toca nem vibra para acordar você.
              </p>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                Dá para ativar um aviso de hora de dormir nas Configurações. Ele aparece só enquanto o app estiver aberto.
              </p>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                Registrar a noite leva poucos segundos — é isso que faz as estatísticas valerem.
              </p>
            </Card>
          </section>
        )}

        {erro && (
          <p role="alert" style={{ margin: 0, color: 'var(--color-erro-texto)' }}>
            {erro}
          </p>
        )}

        <div style={acoesStyle}>
          <Button type="submit" variant="primary" size="md" loading={salvando} style={{ flex: 1 }}>
            {passo === TOTAL_PASSOS ? 'Começar a registrar' : 'Avançar'}
          </Button>
          {passo < TOTAL_PASSOS && (
            <Button type="button" variant="ghost" size="md" onClick={pular} disabled={salvando}>
              {passo === 1 ? 'Agora não' : 'Pular'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
