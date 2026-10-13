import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Field from './Field';

describe('Field (issue #208)', () => {
  it('associa o label ao input (getByLabelText funciona)', () => {
    render(<Field label="E-mail" type="email" />);
    const input = screen.getByLabelText('E-mail');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAttribute('type', 'email');
  });

  it('repasse valor e onChange', () => {
    const onChange = vi.fn();
    render(<Field label="Nome" value="ana" onChange={onChange} />);
    const input = screen.getByLabelText('Nome');
    expect(input).toHaveValue('ana');
    fireEvent.change(input, { target: { value: 'bia' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('sem erro: não marca aria-invalid nem descrição', () => {
    render(<Field label="Senha" />);
    const input = screen.getByLabelText('Senha');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('com erro: aria-invalid + aria-describedby apontando para a mensagem', () => {
    render(<Field label="Senha" error="Mínimo de 8 caracteres" />);
    const input = screen.getByLabelText('Senha');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const descId = input.getAttribute('aria-describedby');
    expect(descId).toBeTruthy();
    const erro = document.getElementById(descId ?? '');
    expect(erro?.textContent).toBe('Mínimo de 8 caracteres');
    // O nome acessível continua só o label (erro fora do <label>).
    expect(screen.getByLabelText('Senha')).toBe(input);
  });
});
