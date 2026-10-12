import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  SONS_DISPONIVEIS,
  ajustarVolume,
  pararSom,
  suportaElementoAudio,
  suportaWebAudio,
  tocarSom,
} from '../lib/player';

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
  cursor: 'pointer',
};

const erroStyle = {
  background: 'var(--alert-error-bg)',
  border: '1px solid var(--alert-error-border)',
  borderRadius: '10px',
  padding: '0.75rem',
  color: 'var(--alert-error-text)',
};

export default function Sons() {
  const webAudioDisponivel = useMemo(() => suportaWebAudio(), []);
  const elementoAudioDisponivel = useMemo(() => suportaElementoAudio(), []);

  // Se não houver Web Audio, inicia nas ambiências CC0 por padrão
  const [somId, setSomId] = useState(() => (webAudioDisponivel ? 'rosa' : 'chuva'));
  const [volume, setVolume] = useState(50);
  const [tocando, setTocando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  const tocandoRef = useRef(false);
  const somIdRef = useRef(somId);

  // Espelha o estado para o handler de visibilitychange, que é registrado uma
  // única vez. useLayoutEffect (e não useEffect): o ref passa a valer junto do
  // commit, antes de a tela mostrar "Pausar som". Com efeito passivo havia uma
  // janela em que a aba já indicava reprodução mas o handler ainda via
  // tocandoRef.current === false — o áudio continuava tocando ao ocultar a aba
  // (issue #150, falha intermitente no CI por timing do efeito passivo).
  useLayoutEffect(() => {
    tocandoRef.current = tocando;
  }, [tocando]);

  useEffect(() => {
    somIdRef.current = somId;
  }, [somId]);

  // Sai da página: nunca deixar áudio tocando órfão
  useEffect(() => () => pararSom(), []);

  // Navegador oculto ou tela travada: pausa sem retomar sozinho (PLANO.md §3)
  useEffect(() => {
    function aoMudarVisibilidade() {
      if (document.hidden && tocandoRef.current) {
        pararSom();
        setTocando(false);
      }
    }
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    return () => document.removeEventListener('visibilitychange', aoMudarVisibilidade);
  }, []);

  const somSelecionado = useMemo(
    () => SONS_DISPONIVEIS.find((s) => s.id === somId) || SONS_DISPONIVEIS[0],
    [somId],
  );

  const podeTocar = useMemo(() => {
    if (somSelecionado.categoria === 'ruido') return webAudioDisponivel;
    if (somSelecionado.categoria === 'ambiencia') return elementoAudioDisponivel;
    return false;
  }, [somSelecionado, webAudioDisponivel, elementoAudioDisponivel]);

  async function iniciar(novoId = somId, novoVolume = volume) {
    try {
      setCarregando(true);
      await tocarSom(novoId, novoVolume / 100);
      setErro(null);
      setTocando(true);
    } catch {
      pararSom();
      setTocando(false);
      const som = SONS_DISPONIVEIS.find((s) => s.id === novoId);
      if (som?.categoria === 'ambiencia') {
        setErro(
          'Não foi possível carregar o arquivo de áudio. Verifique sua conexão ou experimente os sons de ruído (rosa, marrom ou branco), que não dependem de rede.',
        );
      } else {
        setErro(
          'Não foi possível iniciar o som neste navegador. Ele não oferece suporte a áudio gerado por código — tente as opções de ambiência (chuva, ondas ou vento).',
        );
      }
    } finally {
      setCarregando(false);
    }
  }

  function alternarReproducao() {
    if (!podeTocar) return;
    if (tocando) {
      pararSom();
      setTocando(false);
    } else {
      iniciar(somId, volume);
    }
  }

  function escolherSom(novoId) {
    setSomId(novoId);
    setErro(null);
    if (tocandoRef.current) {
      iniciar(novoId, volume);
    }
  }

  function mudarVolume(novoValor) {
    setVolume(novoValor);
    ajustarVolume(novoValor / 100);
  }

  const ambiencias = useMemo(
    () => SONS_DISPONIVEIS.filter((s) => s.categoria === 'ambiencia'),
    [],
  );
  const ruidos = useMemo(
    () => SONS_DISPONIVEIS.filter((s) => s.categoria === 'ruido'),
    [],
  );

  return (
    <section style={conteudo}>
      <h1>Sons de relaxamento</h1>
      <p>
        Áudios para relaxar e adormecer: ambiências CC0 hospedadas no app e ruídos gerados no
        navegador por código (sem tráfego de rede). Toque para começar — nada inicia sozinho,
        conforme as regras dos navegadores.
      </p>

      {somSelecionado.categoria === 'ruido' && !webAudioDisponivel && (
        <p role="alert" style={erroStyle}>
          Este navegador não oferece suporte a áudio gerado por código (Web Audio API). Não é
          possível tocar os ruídos aqui — experimente as ambiências abaixo (chuva, ondas ou vento).
        </p>
      )}

      {somSelecionado.categoria === 'ambiencia' && !elementoAudioDisponivel && (
        <p role="alert" style={erroStyle}>
          Este navegador não oferece suporte ao elemento de áudio nativo.
        </p>
      )}

      {erro && (
        <p role="alert" style={erroStyle}>
          {erro}
        </p>
      )}

      <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 700, fontSize: '15px', padding: 0, marginBottom: '0.25rem' }}>
          Ambiências naturais (CC0)
        </legend>
        {ambiencias.map((opcao) => (
          <label key={opcao.id} style={opcaoStyle}>
            <input
              type="radio"
              name="som-relaxamento"
              value={opcao.id}
              checked={somId === opcao.id}
              onChange={() => escolherSom(opcao.id)}
              style={{ width: '20px', height: '20px' }}
            />
            <span>
              <strong>{opcao.nome}</strong> — {opcao.descricao}
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 700, fontSize: '15px', padding: 0, marginBottom: '0.25rem' }}>
          Ruídos sintetizados (Web Audio API)
        </legend>
        {ruidos.map((opcao) => (
          <label key={opcao.id} style={opcaoStyle}>
            <input
              type="radio"
              name="som-relaxamento"
              value={opcao.id}
              checked={somId === opcao.id}
              onChange={() => escolherSom(opcao.id)}
              style={{ width: '20px', height: '20px' }}
            />
            <span>
              <strong>{opcao.nome}</strong> — {opcao.descricao}
            </span>
          </label>
        ))}
      </fieldset>

      <label
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
          fontSize: '15px',
          fontWeight: 700,
        }}
      >
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

      <button
        type="button"
        onClick={alternarReproducao}
        disabled={!podeTocar || carregando}
        aria-pressed={tocando}
        aria-label={tocando ? 'Pausar som' : 'Tocar som'}
        className="btn btn-primary"
        style={{ opacity: podeTocar ? 1 : 0.6, cursor: podeTocar ? 'pointer' : 'not-allowed' }}
      >
        {carregando ? 'Carregando...' : tocando ? 'Pausar som' : 'Tocar som'}
      </button>

      <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
        Limitação honesta: o áudio pausa quando você sai desta aba ou trava a tela — apps em
        navegador não garantem reprodução em segundo plano contínua (mesma restrição do lembrete
        de dormir).
      </p>

      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
        Licenças e fontes: todas as ambiências utilizam Creative Commons Zero (CC0 1.0 Universal).
        Consulte a tabela completa de fontes e hashes em <code>docs/audio-licencas.md</code>.
      </p>
    </section>
  );
}