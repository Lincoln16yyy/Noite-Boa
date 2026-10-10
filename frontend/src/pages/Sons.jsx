import { useEffect, useMemo, useRef, useState } from 'react';
import {
  TIPOS_RUIDO,
  ajustarVolume,
  pararRuido,
  suportaAudio,
  tocarRuido,
} from '../lib/noise';

const conteudo = {
  maxWidth: '480px',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

const opcaoStyle = {
  minHeight: '48px',
  fontSize: '16px',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
};

const botaoStyle = {
  minHeight: '52px',
  fontSize: '17px',
  fontWeight: 700,
  border: 'none',
  borderRadius: '10px',
  background: '#15142E',
  color: '#FFE9B5',
  cursor: 'pointer',
};

const erroStyle = {
  background: '#FDE8E8',
  border: '1px solid #F5B8B8',
  borderRadius: '10px',
  padding: '0.75rem',
  color: 'var(--color-erro-texto)',
};

export default function Sons() {
  const [tipo, setTipo] = useState('rosa');
  const [volume, setVolume] = useState(50);
  const [tocando, setTocando] = useState(false);
  const [erro, setErro] = useState(null);
  const audioOk = useMemo(() => suportaAudio(), []);
  const tocandoRef = useRef(false);

  useEffect(() => {
    tocandoRef.current = tocando;
  }, [tocando]);

  // sai da página: nunca deixar som tocando órfão
  useEffect(() => () => pararRuido(), []);

  // navegador oculto: pausa (limitação honesta dos navegadores; PLANO.md §3)
  useEffect(() => {
    function aoMudarVisibilidade() {
      if (document.hidden && tocandoRef.current) {
        pararRuido();
        setTocando(false);
      }
    }
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    return () => document.removeEventListener('visibilitychange', aoMudarVisibilidade);
  }, []);

  function iniciar(novoTipo = tipo, novoVolume = volume) {
    try {
      tocarRuido(novoTipo, novoVolume / 100);
      setErro(null);
      setTocando(true);
    } catch {
      setErro(
        'Não foi possível iniciar o som neste navegador. Ele não oferece suporte a áudio gerado por código — tente um navegador mais recente.',
      );
      setTocando(false);
    }
  }

  function alternarReproducao() {
    if (!audioOk) return;
    if (tocando) {
      pararRuido();
      setTocando(false);
    } else {
      iniciar();
    }
  }

  function escolherTipo(novoTipo) {
    setTipo(novoTipo);
    if (tocandoRef.current) iniciar(novoTipo);
  }

  function mudarVolume(valor) {
    setVolume(valor);
    ajustarVolume(valor / 100);
  }

  return (
    <section style={conteudo}>
      <h1>Sons de relaxamento</h1>
      <p>
        Sons de ruído gerados no próprio aparelho: nada é baixado e nenhum arquivo de áudio é
        usado (fase 1 da pesquisa em <code>docs/audio.md</code>). Toque para começar — nada
        sozinho, conforme a regra dos navegadores.
      </p>

      {!audioOk && (
        <p role="alert" style={erroStyle}>
          Este navegador não oferece suporte a áudio gerado por código (Web Audio API). Não é
          possível tocar os sons aqui.
        </p>
      )}
      {erro && audioOk && (
        <p role="alert" style={erroStyle}>
          {erro}
        </p>
      )}

      <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 700, fontSize: '15px', padding: 0 }}>Tipo de ruído</legend>
        {TIPOS_RUIDO.map((opcao) => (
          <label key={opcao.id} style={opcaoStyle}>
            <input
              type="radio"
              name="tipo-ruido"
              value={opcao.id}
              checked={tipo === opcao.id}
              onChange={() => escolherTipo(opcao.id)}
              style={{ width: '20px', height: '20px' }}
            />
            {opcao.nome}
          </label>
        ))}
      </fieldset>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '15px', fontWeight: 700 }}>
        Volume: {volume}%
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={volume}
          onChange={(evento) => mudarVolume(Number(evento.target.value))}
          aria-label="Volume do som"
          style={{ minHeight: '48px' }}
        />
      </label>

      <button type="button" onClick={alternarReproducao} disabled={!audioOk} style={botaoStyle}>
        {tocando ? 'Pausar som' : 'Tocar som'}
      </button>

      <p style={{ fontSize: '14px', color: '#555' }}>
        Limitação honesta: o som para quando você sai desta aba ou trava a tela — apps de
        navegador não são garantidos para tocar em segundo plano (é o mesmo limite do lembrete
        de dormir).
      </p>
    </section>
  );
}
