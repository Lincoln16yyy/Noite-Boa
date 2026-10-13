import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Vitrine from './Vitrine';

describe('Vitrine dos componentes base (issue #208, só dev)', () => {
  it('mostra todos os componentes da vitrine', () => {
    render(<Vitrine />);
    expect(screen.getByRole('heading', { name: 'Vitrine de componentes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Primário' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fechar aviso' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7 dias' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Ação/destaque' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Média de 7 dias: 78% da meta' })).toBeInTheDocument();
    expect(screen.getByText(/Superfície v2/)).toBeInTheDocument();
  });
});
