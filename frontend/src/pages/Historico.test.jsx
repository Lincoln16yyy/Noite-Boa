import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Historico from './Historico';
import { renderWithAuth } from '../test/test-utils';
import { toLocalInput } from '../lib/sleep';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

const baseLog = {
  id: 'log-1',
  sleepStart: '2026-10-07T23:00:00.000Z',
  sleepEnd: '2026-10-08T07:00:00.000Z',
  quality: 4,
  notes: 'dormi bem',
};

function pageResponse(content, totalPages = 1) {
  return { content, totalElements: content.length, totalPages };
}

const mockUser = { id: 'u1', email: 'a@example.com', displayName: 'Teste', timezone: 'America/Sao_Paulo', shareWithFriends: true };

describe('tela de Histórico', () => {
  let fetchMock;
  let state;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    state = { logs: [baseLog] };

    fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options = {}) => {
      const id = typeof url === 'string' ? (url.match(/sleep-logs\/([^?]+)/) || [])[1] : null;

      if (options.method === 'DELETE') {
        state.logs = state.logs.filter((log) => log.id !== id);
        return new Response(null, { status: 204 });
      }
      if (options.method === 'PUT') {
        const body = JSON.parse(options.body);
        state.logs = state.logs.map((log) => (log.id === id ? { ...log, ...body } : log));
        return jsonResponse({ id, ...body });
      }
      if (options.method === 'POST') {
        return jsonResponse({ id: 'novo', ...JSON.parse(options.body) }, 201);
      }
      if (String(url).includes('/me')) return jsonResponse(mockUser);
      const pageParam = Number((String(url).match(/page=(\d+)/) || [])[1] ?? 0);
      return jsonResponse(pageResponse(pageParam === 0 ? state.logs : []));
    });
  });

  function openScreen() {
    renderWithAuth(<Historico />, { user: mockUser, route: '/historico' });
  }

  it('lista as noites registradas com duração, nota e observação', async () => {
    openScreen();
    expect(await screen.findByText(/8h · nota 4/)).toBeInTheDocument();
    expect(screen.getByText('dormi bem')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Paginação' })).toBeInTheDocument();
  });

  it('exclui um registro depois da confirmação', async () => {
    openScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sim, excluir' }));

    expect(await screen.findByText('Você ainda não registrou nenhuma noite de sono.')).toBeInTheDocument();
    const deleteCall = fetchMock.mock.calls.find(([, options]) => options.method === 'DELETE');
    expect(String(deleteCall[0])).toContain('/sleep-logs/log-1');
  });

  it('edita um registro pelo formulário inline', async () => {
    openScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));

    const startInput = screen.getByLabelText('Dormiu às');
    expect(startInput.value).toBe(toLocalInput(new Date(baseLog.sleepStart)));

    fireEvent.change(screen.getByLabelText('Acordou às'), {
      target: { value: toLocalInput(new Date('2026-10-08T08:00:00.000Z')) },
    });
    fireEvent.click(screen.getByTitle('2 Ruim'));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(([, options]) => options.method === 'PUT');
      expect(putCall).toBeTruthy();
      expect(String(putCall[0])).toContain('/sleep-logs/log-1');
      const body = JSON.parse(putCall[1].body);
      expect(body.quality).toBe(2);
      expect(body.sleepEnd).toBe(new Date('2026-10-08T08:00:00.000Z').toISOString());
    });
    expect(await screen.findByText(/9h · nota 2/)).toBeInTheDocument();
  });

  it('mostra estado vazio amigável com atalho para registrar', async () => {
    state.logs = [];
    openScreen();
    expect(await screen.findByText('Você ainda não registrou nenhuma noite de sono.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Registrar a primeira noite/ })).toHaveAttribute(
      'href',
      '/registrar',
    );
  });

  it('avança e volta de página', async () => {
    fetchMock.mockImplementation(async (url) => {
      const pageParam = Number((String(url).match(/page=(\d+)/) || [])[1] ?? 0);
      const content =
        pageParam === 0
          ? [{ ...baseLog, id: 'log-1' }]
          : [{ ...baseLog, id: 'log-2', notes: 'página dois' }];
      return jsonResponse({ content, totalElements: 12, totalPages: 3 });
    });

    openScreen();
    expect(await screen.findByText(/8h · nota 4/)).toBeInTheDocument();
    expect(screen.getByText(/Página 1 de 3/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(await screen.findByText('página dois')).toBeInTheDocument();
    expect(screen.getByText(/Página 2 de 3/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(await screen.findByText('dormi bem')).toBeInTheDocument();
    expect(screen.getByText(/Página 1 de 3/)).toBeInTheDocument();
  });
});
