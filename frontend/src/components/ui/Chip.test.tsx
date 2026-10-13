import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Chip from './Chip';

describe('Chip (issue #208)', () => {
  it('renderiza o rótulo', () => {
    render(<Chip>7 dias</Chip>);
    expect(screen.getByRole('button', { name: '7 dias' })).toBeInTheDocument();
  });

  it('reflete o estado selecionado em aria-pressed', () => {
    const { rerender } = render(<Chip selected>30 dias</Chip>);
    expect(screen.getByRole('button', { name: '30 dias' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    rerender(<Chip selected={false}>30 dias</Chip>);
    expect(screen.getByRole('button', { name: '30 dias' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('dispara onClick quando habilitado', () => {
    const onClick = vi.fn();
    render(
      <Chip onClick={onClick} selected={false}>
        7 dias
      </Chip>,
    );
    fireEvent.click(screen.getByRole('button', { name: '7 dias' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('não dispara onClick desabilitado', () => {
    const onClick = vi.fn();
    render(
      <Chip disabled onClick={onClick}>
        7 dias
      </Chip>,
    );
    fireEvent.click(screen.getByRole('button', { name: '7 dias' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
