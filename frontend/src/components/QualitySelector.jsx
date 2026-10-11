import { useId } from 'react';

/**
 * Rótulos de qualidade com emojis discretos
 */
export const QUALITY_OPTIONS = [
  { value: 1, label: 'Péssima', shortLabel: '1', emoji: '😫' },
  { value: 2, label: 'Ruim', shortLabel: '2', emoji: '😕' },
  { value: 3, label: 'Ok', shortLabel: '3', emoji: '😐' },
  { value: 4, label: 'Boa', shortLabel: '4', emoji: '🙂' },
  { value: 5, label: 'Ótima', shortLabel: '5', emoji: '😄' },
];

/**
 * Seletor de qualidade de sono acessível.
 * Radiogroup nativo com rótulos visuais (emoji + texto curto) e títulos completos.
 * Usa tokens CSS da identidade visual.
 *
 * @param {Object} props
 * @param {number} props.value - Valor atual (1-5, 0 = não selecionado)
 * @param {(value: number) => void} props.onChange - Callback de mudança
 * @param {string} [props.name] - Nome do radiogroup (para formulários)
 * @param {boolean} [props.disabled] - Desabilita o seletor
 * @param {string} [props.legend] - Legenda do fieldset
 * @param {string} [props.errorId] - ID do elemento de erro (aria-describedby)
 */
export default function QualitySelector({
  value,
  onChange,
  name = 'quality',
  disabled = false,
  legend = 'Como foi a noite?',
  errorId,
}) {
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
              <span style={{ fontSize: '11px', fontWeight: 400, opacity: 0.7, marginTop: '2px' }}>
                {option.label}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const fieldsetStyle = {
  border: 'none',
  padding: 0,
  margin: 0,
};

const legendStyle = {
  fontSize: '15px',
  fontWeight: 700,
  marginBottom: '0.5rem',
  color: 'var(--color-noite)',
};

const groupStyle = {
  display: 'flex',
  gap: '0.5rem',
  flexWrap: 'wrap',
};

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  cursor: 'pointer',
  flex: '1 1 70px',
  minWidth: '70px',
};

const inputStyle = {
  position: 'absolute',
  opacity: 0,
  width: 0,
  height: 0,
  pointerEvents: 'none',
};

const buttonStyle = (selected) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '2px',
  minHeight: '72px',
  padding: '8px 4px',
  fontFamily: 'var(--font-sans)',
  fontSize: '13px',
  fontWeight: selected ? 700 : 400,
  borderRadius: '12px',
  border: selected ? '2px solid var(--color-indigo)' : '1px solid var(--color-lavanda)',
  background: selected ? 'var(--color-luar)' : '#FFFFFF',
  color: selected ? 'var(--color-noite)' : 'var(--color-noite)',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  boxShadow: selected ? '0 2px 8px rgba(63, 60, 187, 0.25)' : 'none',
});