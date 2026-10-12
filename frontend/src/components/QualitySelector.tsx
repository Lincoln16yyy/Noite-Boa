import { useId } from 'react';
import type { CSSProperties } from 'react';

/** Uma nota de qualidade do sono (1-5) com rótulo e emoji. */
export interface QualityOption {
  value: number;
  label: string;
  shortLabel: string;
  emoji: string;
}

/**
 * Rótulos de qualidade com emojis discretos
 */
export const QUALITY_OPTIONS: QualityOption[] = [
  { value: 1, label: 'Péssima', shortLabel: '1', emoji: '😫' },
  { value: 2, label: 'Ruim', shortLabel: '2', emoji: '😕' },
  { value: 3, label: 'Ok', shortLabel: '3', emoji: '😐' },
  { value: 4, label: 'Boa', shortLabel: '4', emoji: '🙂' },
  { value: 5, label: 'Ótima', shortLabel: '5', emoji: '😄' },
];

/** Props de `QualitySelector`. */
export interface QualitySelectorProps {
  /** Valor atual (1-5, 0 = não selecionado) */
  value: number;
  /** Callback de mudança */
  onChange: (value: number) => void;
  /** Nome do radiogroup (para formulários) */
  name?: string;
  /** Desabilita o seletor */
  disabled?: boolean;
  /** Legenda do fieldset */
  legend?: string;
  /** ID do elemento de erro (aria-describedby) */
  errorId?: string;
}

/**
 * Seletor de qualidade de sono acessível.
 * Radiogroup nativo com rótulos visuais (emoji + texto curto) e títulos completos.
 * Usa tokens CSS da identidade visual.
 */
export default function QualitySelector({
  value,
  onChange,
  name = 'quality',
  disabled = false,
  legend = 'Como foi a noite?',
  errorId,
}: QualitySelectorProps) {
  const groupId = useId();

  return (
    <fieldset style={fieldsetStyle} role="radiogroup" aria-labelledby={`${groupId}-legend`} aria-describedby={errorId}>
      <legend id={`${groupId}-legend`} style={legendStyle}>
        {legend}
      </legend>
      <div style={groupStyle} role="radiogroup" aria-labelledby={`${groupId}-legend`}>
        {QUALITY_OPTIONS.map((option) => (
          <label key={option.value} style={labelStyle}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => !disabled && onChange(option.value)}
              disabled={disabled}
              style={inputStyle}
              aria-label={`${option.label} (${option.value})`}
            />
            <span style={buttonStyle(option.value === value)}>
              <span style={{ fontSize: '20px', lineHeight: 1, display: 'block', marginBottom: '2px' }}>
                {option.emoji}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {option.shortLabel}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 400, opacity: 0.7, marginTop: '2px', textAlign: 'center', overflowWrap: 'anywhere', lineHeight: 1.1 }}>
                {option.label}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const fieldsetStyle: CSSProperties = {
  border: 'none',
  padding: 0,
  margin: 0,
};

const legendStyle: CSSProperties = {
  fontSize: '15px',
  fontWeight: 700,
  marginBottom: '0.5rem',
  color: 'var(--color-noite)',
};

const groupStyle: CSSProperties = {
  // Grade de 5 colunas: as cinco notas ficam em UMA linha no celular
  // (antes quebravam em 4 + 1). minmax(0, 1fr) deixa as colunas encolherem.
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  gap: '0.375rem',
};

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  cursor: 'pointer',
  minWidth: 0,
};

const inputStyle: CSSProperties = {
  position: 'absolute',
  opacity: 0,
  width: 0,
  height: 0,
  pointerEvents: 'none',
};

const buttonStyle = (selected: boolean): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '2px',
  minHeight: '72px',
  padding: '8px 2px',
  fontFamily: 'var(--font-sans)',
  fontSize: '13px',
  fontWeight: selected ? 700 : 400,
  borderRadius: '12px',
  // Tokens de TEMA (não a cor fixa da marca): no modo escuro a pílula inativa
  // acompanha o fundo em vez de continuar branca (#158).
  border: selected ? '2px solid var(--color-indigo)' : '1px solid var(--input-border)',
  background: selected ? 'var(--color-luar)' : 'var(--input-bg)',
  color: selected ? 'var(--color-noite)' : 'var(--text-primary)',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  boxShadow: selected ? '0 2px 8px rgba(63, 60, 187, 0.25)' : 'none',
});