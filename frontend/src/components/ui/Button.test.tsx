import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Button from './Button';

describe('Button (issue #208)', () => {
  it('renderiza o conteúdo e é um <button> de verdade', () => {
    render(<Button>Salvar</Button>);
    const btn = screen.getByRole('button', { name: 'Salvar' });
    expect(btn.tagName).toBe('BUTTON');
  });

  it('aplica variante e tamanho como classes', () => {
    render(
      <Button variant="danger" size="md">
        Excluir
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Excluir' });
    expect(btn.className).toContain('ui-btn--danger');
    expect(btn.className).toContain('ui-btn--md');
  });

  it('tem type="button" por padrão (não envia formulário por acidente)', () => {
    render(<Button>Ação</Button>);
    expect(screen.getByRole('button', { name: 'Ação' })).toHaveAttribute('type', 'button');
  });

  it('dispara onClick quando habilitado', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Tentar</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('não dispara onClick quando desabilitado', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Bloqueado
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Bloqueado' });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('loading: desabilita, marca aria-busy e mantém o nome acessível', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Salvando…
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Salvando…' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('o indicador de loading é decorativo (aria-hidden)', () => {
    const { container } = render(<Button loading>Enviando</Button>);
    const spinner = container.querySelector('.ui-btn__spinner');
    expect(spinner).not.toBeNull();
    expect(spinner?.getAttribute('aria-hidden')).toBe('true');
  });
});
