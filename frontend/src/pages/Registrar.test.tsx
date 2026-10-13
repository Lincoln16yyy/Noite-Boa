import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Registrar from './Registrar';
import { renderWithAuth } from '../test/test-utils';

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status }) as any;
}

const mockUser = { id: 'u1', email: 'a@example.com', displayName: 'Teste', timezone: 'America/Sao_Paulo', shareWithFriends: true };

function openScreen() {
  renderWithAuth(<Registrar />, { user: mockUser, route: '/registrar' });
}

describe('tela de Registrar sono', () => {
  let fetchMock: any;
  let posts: any[] = [];

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    posts = [];
    fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, options: any = {}) => {
      if (String(url).includes('/me')) return jsonResponse(mockUser);
      if (options.method === 'POST') {
        const body = JSON.parse(options.body as any);
        posts.push(body);
        return jsonResponse({ id: 'novo-id', ...body }, 201);
      }
      return jsonResponse({ content: [], totalElements: 0 });
    });
  });

  it('preenche os padrões inteligentes (ontem à noite / hoje de manhã)', async () => {
    openScreen();
    const start = await screen.findByLabelText('Dormiu às');
    const end = screen.getByLabelText('Acordou às');
    expect((start as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(new Date((end as HTMLInputElement).value).getTime()).toBeGreaterThan(new Date((start as HTMLInputElement).value).getTime());
  });

  it('salva o registro e mostra nos últimos registros', async () => {
    fetchMock.mockImplementation(async (_url: any, options: any = {}) => {
      if (options.method === 'POST') {
        const body = JSON.parse(options.body as any);
        posts.push(body);
        return jsonResponse({ id: 'novo-id', ...body }, 201);
      }
      return jsonResponse({
        content: [
          {
            id: 'novo-id',
            sleepStart: '2026-10-07T23:00:00.000Z',
            sleepEnd: '2026-10-08T07:00:00.000Z',
            quality: 4,
            notes: 'dormi bem',
          },
        ],
        totalElements: 1,
      });
    });

    openScreen();
    fireEvent.change(await screen.findByLabelText('Dormiu às'), {
      target: { value: '2026-10-07T23:00' },
    });
    fireEvent.change(screen.getByLabelText('Acordou às'), {
      target: { value: '2026-10-08T07:00' },
    });
    // Clica no radio de qualidade 4 (Boa) via label (aria-label = "Boa (4)")
    fireEvent.click(screen.getByLabelText('Boa (4)'));
    fireEvent.change(screen.getByLabelText(/Observação/), { target: { value: 'dormi bem' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar registro' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Noite registrada: 8h de sono.');
    expect(posts).toHaveLength(1);
    expect(posts[0]).toEqual({
      sleepStart: new Date('2026-10-07T23:00').toISOString(),
      sleepEnd: new Date('2026-10-08T07:00').toISOString(),
      quality: 4,
      notes: 'dormi bem',
    });
    expect(await screen.findByText(/dormi bem/)).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4)); // /me + lista inicial + POST + lista atualizada
  });

  it('bloqueia acordar antes de dormir', async () => {
    openScreen();
    fireEvent.change(await screen.findByLabelText('Dormiu às'), {
      target: { value: '2026-10-08T08:00' },
    });
    fireEvent.change(screen.getByLabelText('Acordou às'), {
      target: { value: '2026-10-08T07:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar registro' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('depois de dormir');
    expect(posts).toHaveLength(0);
  });

  it('exige escolher a qualidade', async () => {
    openScreen();
    fireEvent.change(await screen.findByLabelText('Dormiu às'), {
      target: { value: '2026-10-07T23:00' },
    });
    fireEvent.change(screen.getByLabelText('Acordou às'), {
      target: { value: '2026-10-08T07:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar registro' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('1 a 5');
    expect(posts).toHaveLength(0);
  });

  it('mostra estado vazio quando não há registros', async () => {
    openScreen();
    expect(await screen.findByText('Nenhuma noite registrada ainda.')).toBeInTheDocument();
  });

  it('não cria duplicata quando o envio é clicado duas vezes (#99)', async () => {
    let liberarPost;
    fetchMock.mockImplementation(async (url: any, options: any = {}) => {
      if (String(url).includes('/me')) return jsonResponse(mockUser);
      if (options.method === 'POST') {
        const body = JSON.parse(options.body as any);
        posts.push(body);
        await new Promise((resolver: any) => {
          liberarPost = resolver;
        });
        return jsonResponse({ id: 'novo-id', ...body }, 201);
      }
      return jsonResponse({ content: [], totalElements: 0 });
    });

    openScreen();
    fireEvent.change(await screen.findByLabelText('Dormiu às'), {
      target: { value: '2026-10-07T23:00' },
    });
    fireEvent.change(screen.getByLabelText('Acordou às'), {
      target: { value: '2026-10-08T07:00' },
    });
    fireEvent.click(screen.getByLabelText('Boa (4)'));

    fireEvent.click(screen.getByRole('button', { name: 'Salvar registro' }));

    // Durante o envio: botão desabilitado com o texto "Salvando…"
    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled();

    // Um segundo clique não dispara nova requisição
    fireEvent.click(screen.getByRole('button', { name: 'Salvando…' }));
    expect(posts).toHaveLength(1);

    liberarPost!();
    expect(await screen.findByRole('status')).toHaveTextContent('Noite registrada');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar registro' })).toBeEnabled());
    expect(posts).toHaveLength(1);
  });

  it('exibe a mensagem de sobreposição vinda do servidor (409)', async () => {
    fetchMock!.mockImplementation(async (url: any, options: any = {}) => {
      if (String(url).includes('/me')) return jsonResponse(mockUser);
      if (options.method === 'POST') {
        return jsonResponse({ detail: 'Este período se sobrepõe a um registro existente.' }, 409);
      }
      return jsonResponse({ content: [], totalElements: 0 });
    });

    openScreen();
    fireEvent.change(await screen.findByLabelText('Dormiu às'), {
      target: { value: '2026-10-07T23:00' },
    });
    fireEvent.change(screen.getByLabelText('Acordou às'), {
      target: { value: '2026-10-08T07:00' },
    });
    fireEvent.click(screen.getByLabelText('Boa (4)'));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar registro' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('sobrepõe');
    // A sessão permanece e o botão volta a ficar habilitado para tentar de novo
    expect(screen.getByRole('button', { name: 'Salvar registro' })).toBeEnabled();
  });
});
