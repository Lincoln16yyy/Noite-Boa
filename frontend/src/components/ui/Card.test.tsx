import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Card from './Card';

describe('Card (issue #208)', () => {
  it('renderiza o conteúdo com a classe de superfície', () => {
    render(
      <Card>
        <p>Noite tranquila</p>
      </Card>,
    );
    expect(screen.getByText('Noite tranquila')).toBeInTheDocument();
    const card = screen.getByText('Noite tranquila').closest('.ui-card');
    expect(card).not.toBeNull();
  });

  it('aceita className extra e estilo próprio', () => {
    const { container } = render(
      <Card className="minha-classe" style={{ marginBottom: '1rem' }}>
        x
      </Card>,
    );
    const card = container.querySelector('.ui-card');
    expect(card?.className).toContain('minha-classe');
    expect(card?.getAttribute('style')).toContain('margin-bottom');
  });
});
