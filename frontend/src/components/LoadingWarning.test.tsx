import { render, screen, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoadingWarning from './LoadingWarning';

describe('LoadingWarning', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('não renderiza quando isLoading é false', () => {
    render(<LoadingWarning isLoading={false} />);
    expect(screen.queryByText(/acordando o servidor/i)).not.toBeInTheDocument();
  });

  it('não renderiza imediatamente quando isLoading é true', () => {
    render(<LoadingWarning isLoading={true} delayMs={4000} />);
    expect(screen.queryByText(/acordando o servidor/i)).not.toBeInTheDocument();
  });

  it('renderiza aviso após o delay configurado', () => {
    render(<LoadingWarning isLoading={true} delayMs={4000} />);
    act(() => vi.advanceTimersByTime(3999));
    expect(screen.queryByText(/acordando o servidor/i)).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText(/acordando o servidor/i)).toBeInTheDocument();
  });

  it('esconde aviso quando isLoading muda para false', () => {
    const { rerender } = render(<LoadingWarning isLoading={true} delayMs={100} />);
    act(() => vi.advanceTimersByTime(101));
    expect(screen.getByText(/acordando o servidor/i)).toBeInTheDocument();
    rerender(<LoadingWarning isLoading={false} delayMs={100} />);
    expect(screen.queryByText(/acordando o servidor/i)).not.toBeInTheDocument();
  });

  it('limpa timer ao desmontar', () => {
    const { unmount } = render(<LoadingWarning isLoading={true} delayMs={4000} />);
    unmount();
    act(() => vi.advanceTimersByTime(5000));
    // não deve lançar erro
    expect(true).toBe(true);
  });

  it('usa delay padrão de 4000ms quando não informado', () => {
    render(<LoadingWarning isLoading={true} />);
    act(() => vi.advanceTimersByTime(3999));
    expect(screen.queryByText(/acordando o servidor/i)).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText(/acordando o servidor/i)).toBeInTheDocument();
  });
});