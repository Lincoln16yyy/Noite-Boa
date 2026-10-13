import { useId } from 'react';
import type { CSSProperties, InputHTMLAttributes } from 'react';
import './ui.css';

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  /** Texto do rótulo (associado ao input por htmlFor/id). */
  label: string;
  /** Mensagem de erro: marca o campo com aria-invalid e liga por aria-describedby. */
  error?: string;
  /** Classe/estilo no wrapper (para encaixe no layout da tela). */
  className?: string;
  style?: CSSProperties;
}

/**
 * Campo de formulário (issue #208): label + input (classe `.field`) + erro.
 * O rótulo nunca envolve o input — assim o nome acessível do campo é
 * somente o label, sem misturar texto de erro.
 */
export default function Field({ label, error, className, style, id, ...rest }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const erroId = `${inputId}-erro`;
  const classes = ['ui-field', className].filter(Boolean).join(' ');

  return (
    <div className={classes} style={style}>
      <label className="ui-field__label" htmlFor={inputId}>
        {label}
      </label>
      <input
        {...rest}
        id={inputId}
        className="field"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? erroId : undefined}
      />
      {error && (
        <span className="ui-field__erro" id={erroId}>
          {error}
        </span>
      )}
    </div>
  );
}
