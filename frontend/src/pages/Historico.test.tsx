import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Historico from './Historico';
import { renderWithAuth } from '../test/test-utils';
import { localInputNoFuso } from '../lib/fuso';

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status }) as any;
}

const baseLog = {
  id: 'log-1',
  sleepStart: '2026-10-07T23:00:00.000Z',
  sleepEnd: '2026-10-08T07:00:00.000Z',
  quality: 4,
  notes: 'dormi bem',
};

function pageResponse(content: any[], totalPages = 1) {
  return { content, totalElements: content.length, totalPages };
}

const mockUser = { id: 'u1', email: 'a@example.com', displayName: 'Teste', timezone: 'America/Sao_Paulo', shareWithFriends: true };

describe('tela de Histórico', () => {
  let fetchMock: any;
  let state: any;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    state = { logs: [baseLog], timezone: 'America/Sao_Paulo' };

    fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options = {}) => {
      const id = typeof url === 'string' ? (url.match(/sleep-logs\/([^?]+)/) || [])[1] : null;

      if (options.method === 'DELETE') {
        state.logs = state.logs.filter((log: any) => log.id !== id);
        return new Response(null, { status: 204 });
      }
      if (options.method === 'PUT') {
        const body = JSON.parse(options.body as any);
        state.logs = state.logs.map((log: any) => (log.id === id ? { ...log, ...body } : log));
        return jsonResponse({ id, ...body });
      }
      if (options.method === 'POST') {
        return jsonResponse({ id: 'novo', ...JSON.parse(options.body as any) }, 201);
      }
      if (String(url).includes('/me')) return jsonResponse({ ...mockUser, timezone: state.timezone });
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
    const deleteCall = fetchMock.mock.calls.find(([, options]: any) => options.method === 'DELETE');
    expect(String(deleteCall[0])).toContain('/sleep-logs/log-1');
  });

  it('edita um registro pelo formulário inline', async () => {
    openScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));

    const startInput = screen.getByLabelText('Dormiu às');
    expect((startInput as HTMLInputElement).value).toBe(localInputNoFuso(new Date(baseLog.sleepStart), mockUser.timezone));

    fireEvent.change(screen.getByLabelText('Acordou às'), {
      target: { value: localInputNoFuso(new Date('2026-10-08T08:00:00.000Z'), mockUser.timezone) },
    });
    // Clica no radio de qualidade 2 (Ruim) via label
    fireEvent.click(screen.getByLabelText('Ruim (2)'));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(([, options]: any) => options.method === 'PUT');
      expect(putCall).toBeTruthy();
      expect(String(putCall[0])).toContain('/sleep-logs/log-1');
      const body = JSON.parse(putCall[1].body as any);
      expect(body.quality).toBe(2);
      expect(body.sleepEnd).toBe(new Date('2026-10-08T08:00:00.000Z').toISOString());
    });
    expect(await screen.findByText(/9h · nota 2/)).toBeInTheDocument();
  });

  it('desabilita o botão e mostra "Salvando…" durante o envio da edição (#99)', async () => {
    let liberarPut: any;
    fetchMock.mockImplementation(async (url: any, options: any = {}) => {
      if (String(url).includes('/me')) return jsonResponse(mockUser);
      if (options.method === 'PUT') {
        await new Promise((resolver: any) => {
          liberarPut = resolver;
        });
        const body = JSON.parse(options.body as any);
        return jsonResponse({ id: 'log-1', ...body });
      }
      return jsonResponse(pageResponse(state.logs));
    });

    openScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    fireEvent.click(screen.getByLabelText('Ruim (2)'));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    // Durante o envio: botão desabilitado com "Salvando…"; clique extra não reenvia
    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Salvando…' }));
    expect(fetchMock.mock.calls.filter(([, options]: any) => options.method === 'PUT')).toHaveLength(1);

    liberarPut!();
    // Ao terminar, o formulário inline fecha e a lista volta
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument());
    expect(fetchMock.mock.calls.filter(([, options]: any) => options.method === 'PUT')).toHaveLength(1);
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
    fetchMock.mockImplementation(async (url: any) => {
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

  it('exibe os horários no fuso do perfil, não no do aparelho (issue #102)', async () => {
    // 2026-10-07T23:00Z: São Paulo = 07/10 20h00 · Tóquio = 08/10 08h00
    state.timezone = 'America/Sao_Paulo';
    openScreen();
    expect(await screen.findByText('07/10 20h00 → 08/10 04h00')).toBeInTheDocument();

    state.timezone = 'Asia/Tokyo';
    openScreen();
    expect(await screen.findByText('08/10 08h00 → 08/10 16h00')).toBeInTheDocument();
  });

  it('abre a edição e envia no fuso do perfil (issue #102)', async () => {
    state.timezone = 'Asia/Tokyo';
    openScreen();

    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    // parede em Tóquio: 2026-10-07T23:00Z = 08/10 08:00 (acordou 16:00)
    const startInput = await screen.findByDisplayValue('2026-10-08T08:00');
    fireEvent.change(startInput, { target: { value: '2026-10-08T06:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(([, options]: any) => options.method === 'PUT');
      expect(putCall).toBeTruthy();
      const body = JSON.parse(putCall[1].body as any);
      // digitou 06:00 de parede em Tóquio (UTC+9) → 2026-10-07T21:00Z
      expect(body.sleepStart).toBe('2026-10-07T21:00:00.000Z');
    });
  });
});
