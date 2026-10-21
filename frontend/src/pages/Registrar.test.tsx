import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5)); // /me + /goal + lista inicial + POST + lista atualizada
  });

  it('mostra a duração ao vivo e a % da meta conforme os horários mudam (#212)', async () => {
    openScreen();
    // Padrões inteligentes trazem uma duração válida qualquer que seja o horário.
    await screen.findByLabelText('Dormiu às');
    fireEvent.change(screen.getByLabelText('Dormiu às'), { target: { value: '2026-10-07T23:10' } });
    fireEvent.change(screen.getByLabelText('Acordou às'), { target: { value: '2026-10-08T06:40' } });

    // 23:10 → 06:40 = 7h30 = 450 min; meta padrão do mock (/goal ausente) = 480 → 94%
    expect(screen.getByText('7h 30min')).toBeInTheDocument();
    expect(screen.getByText('Meta de 8h · 94%')).toBeInTheDocument();
    // O rótulo do dia acompanha a data digitada (07/10 é uma data antiga).
    expect(screen.getByText('07/10')).toBeInTheDocument();
  });

  it('mostra "—" enquanto os horários não formam uma duração válida', async () => {
    openScreen();
    fireEvent.change(await screen.findByLabelText('Dormiu às'), { target: { value: '2026-10-08T08:00' } });
    fireEvent.change(screen.getByLabelText('Acordou às'), { target: { value: '2026-10-08T07:00' } });
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Preencha os horários para ver a duração')).toBeInTheDocument();
  });

  it('navega a qualidade pelo teclado (setas) — radiogroup nativo (#212)', async () => {
    const usuario = userEvent.setup();
    openScreen();

    // Foco na primeira opção; as setas percorrem o grupo (comportamento
    // nativo do radiogroup — jsdom não implementa setas, daí o user-event).
    const pessima = await screen.findByRole('radio', { name: 'Péssima (1)' });
    pessima.focus();
    expect(pessima).toHaveFocus();

    await usuario.keyboard('{ArrowRight}');
    expect(await screen.findByRole('radio', { name: 'Ruim (2)' })).toBeChecked();

    // Seta para a esquerda volta uma casa.
    await usuario.keyboard('{ArrowLeft}');
    expect(await screen.findByRole('radio', { name: 'Péssima (1)' })).toBeChecked();

    // Quatro setas para a direita chegam à 5 (o grupo é circular).
    await usuario.keyboard('{ArrowRight>4/}');
    expect(await screen.findByRole('radio', { name: 'Ótima (5)' })).toBeChecked();
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
  it('não salva o registro se a tela é de outra sessão (#298)', async () => {
    openScreen();
    await screen.findByLabelText('Dormiu às');
    fireEvent.click(screen.getByLabelText('Boa (4)'));

    localStorage.setItem('token', 'jwt-B');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar registro' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/sessão mudou/i);
    expect(posts).toHaveLength(0);
    expect(localStorage.getItem('token')).toBe('jwt-B');
  });

  it('não salva o formulário da sessão anterior depois da troca (#298)', async () => {
    openScreen();
    await screen.findByLabelText('Dormiu às');
    fireEvent.click(screen.getByLabelText('Boa (4)'));

    // O contexto processou a troca: a tela continua com o que foi digitado
    // para a conta anterior.
    localStorage.setItem('token', 'jwt-B');
    await act(async () => {
      window.dispatchEvent(new CustomEvent('noiteboa:session-change'));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar registro' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/sessão mudou/i);
    expect(posts).toHaveLength(0);
  });

});
