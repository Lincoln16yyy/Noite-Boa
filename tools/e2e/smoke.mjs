// Teste de fumaça E2E (issue #159): sobe o app compilado com a API simulada
// (que exige Authorization, como o back-end real) e cobre os fluxos que já
// quebraram sem os testes unitários pegarem: login, sessão, registrar noite,
// sair e legibilidade no modo escuro.
//
// Rodar localmente:
//   cd frontend && npm ci && npm run build
//   cd ../tools/e2e && npm ci && npm run smoke
//
// Variáveis:
//   BASE_URL    app servido (padrão http://localhost:4173); se ausente, o
//               próprio script sobe `vite preview`
//   CHROME_PATH Chrome/Chromium do sistema (no CI usamos o do runner); sem
//               isso, usa o Chromium embutido do @sparticuz/chromium
//   API_PORT    porta que o front chama em VITE_API_URL (padrão 8080)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(__dirname, '..', '..');
const frontendDir = path.join(raiz, 'frontend');
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const API_PORT = process.env.API_PORT || '8080';

// ---- API simulada (espelha rotas do back-end) ----
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const agora = new Date();
const diasAtras = (n) => new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - n);

const daily = [6, 5, 4, 3, 2, 1].map((n, i) => ({
  date: iso(diasAtras(n)),
  hoursSlept: [6.8, 7.4, 8.1, 5.9, 7.7, 8.4][i],
  bedtime: ['23:40', '23:15', '22:50', '00:20', '23:05', '22:45'][i],
}));
const logs = [1, 2, 3].map((n, i) => {
  const inicio = diasAtras(n);
  return {
    id: `id-${i}`,
    sleepStart: inicio.toISOString(),
    sleepEnd: new Date(inicio.getTime() + 7.5 * 3600e3).toISOString(),
    quality: [4, 3, 5][i],
    notes: null,
  };
});

const usuario = { id: 'u1', email: 'lincoln@example.com', displayName: 'Lincoln', timezone: 'America/Sao_Paulo', shareWithFriends: true };
const mocks = {
  '/me': usuario,
  '/goal': { targetMinutes: 480, bedtime: '23:00:00', wakeTime: '07:00:00' },
  '/stats/summary': { days: 7, averageHours: 7.35, consistencyMinutes: 38, sleepDebtMinutes: 150, daily },
  '/sleep-logs': { content: logs, totalPages: 1, totalElements: 3, number: 0, size: 20 },
  '/friends': [],
  '/friends/requests': { sent: [], received: [] },
  '/friends/ranking': { days: 7, ranking: [] },
};

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const json = (status, corpo) => ({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(corpo) });

// ---- infraestrutura ----
async function subirPreview() {
  const viteBin = path.join(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!fs.existsSync(viteBin)) {
    throw new Error(`não achei o vite em ${viteBin}; rode \`npm ci && npm run build\` no frontend`);
  }
  return spawn(process.execPath, [viteBin, 'preview', '--port', '4173', '--strictPort'], {
    cwd: frontendDir,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
}

async function esperarServidor(url, timeoutMs = 30000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // ainda não subiu
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`o servidor não respondeu em ${url} em ${timeoutMs}ms`);
}

async function lancarNavegador() {
  const chrome = process.env.CHROME_PATH;
  if (chrome && fs.existsSync(chrome)) {
    return puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  }
  const { default: chromium } = await import('@sparticuz/chromium');
  return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: 'shell' });
}

function prepararIntercepcao(page) {
  return page.setRequestInterception(true).then(() => {
    page.on('request', (req) => {
      const u = new URL(req.url());
      if (u.hostname === 'localhost' && u.port === API_PORT) {
        if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: cors });
        const rota = u.pathname.replace(/^\/api/, '');
        // A API real exige token: sem Authorization, 401 (exceto login/cadastro).
        const autenticado = Boolean(req.headers().authorization);
        if (rota === '/auth/login' && req.method() === 'POST') {
          return req.respond(json(200, { accessToken: 'fake.jwt.token' }));
        }
        if (rota === '/auth/register' && req.method() === 'POST') {
          return req.respond(json(201, { accessToken: 'fake.jwt.token' }));
        }
        if (!autenticado) {
          return req.respond(json(401, { detail: 'não autenticado' }));
        }
        if (rota === '/sleep-logs' && req.method() === 'POST') {
          const corpo = JSON.parse(req.postData() || '{}');
          return req.respond(json(201, { id: 'novo', ...corpo }));
        }
        const mock = mocks[rota];
        if (mock !== undefined) return req.respond(json(200, mock));
        return req.respond(json(404, { detail: 'mock não definido' }));
      }
      // Fontes do Google não devem travar/pendurar o teste: responde vazio.
      if (u.hostname.endsWith('googleapis.com') || u.hostname.endsWith('gstatic.com')) {
        return req.respond({ status: 200, contentType: 'text/css', body: '' });
      }
      return req.continue();
    });
  });
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function criarVerificador() {
  let falhas = 0;
  return {
    get falhas() { return falhas; },
    async check(nome, fn) {
      try {
        await fn();
        console.log('ok   ', nome);
      } catch (e) {
        falhas += 1;
        console.log('FALHA', nome, '::', e.message);
      }
    },
  };
}

// ---- execução ----
let servidor = null;
let navegador = null;
let pagina = null;
let falhas = 1; // falha por padrão se algo estourar antes de rodar os cenários

try {
  if (!process.env.BASE_URL) {
    servidor = await subirPreview();
    await esperarServidor(BASE + '/');
  }

  navegador = await lancarNavegador();
  pagina = await navegador.newPage();
  await pagina.setViewport({ width: 1280, height: 800 });
  await prepararIntercepcao(pagina);

  const irPara = (caminho) => pagina.goto(BASE + caminho, { waitUntil: 'load', timeout: 30000 }).then(() => dormir(300));
  const texto = () => pagina.evaluate(() => document.body.innerText);
  const verificar = criarVerificador();

  await verificar.check('visitante vê Entrar', async () => {
    await irPara('/');
    if (!/Entrar/i.test(await texto())) throw new Error('não achei "Entrar" na home deslogada');
  });

  // Critério de aceite: falha se o login deixar o usuário em /login.
  await verificar.check('login correto vai para /dashboard', async () => {
    await irPara('/login');
    await pagina.type('input[type=email]', 'lincoln@example.com');
    await pagina.type('input[type=password]', 'segredo123');
    await Promise.all([
      pagina.waitForFunction(() => location.pathname === '/dashboard', { timeout: 10000 }),
      pagina.click('button[type=submit]'),
    ]);
    if (pagina.url().includes('/login')) throw new Error('continuou em /login após o login');
  });

  await verificar.check('recarregar mantém a sessão', async () => {
    await pagina.reload({ waitUntil: 'load', timeout: 30000 });
    await pagina.waitForFunction(() => location.pathname === '/dashboard', { timeout: 10000 });
    if (!/Sair/.test(await texto())) throw new Error('não achei "Sair" depois de recarregar (sessão caiu)');
  });

  await verificar.check('registrar uma noite', async () => {
    await irPara('/registrar');
    // A qualidade começa em 0 (obrigatória): marca "Boa" antes de salvar.
    await pagina.evaluate(() => document.querySelector('input[name=quality][value="4"]').click());
    await Promise.all([
      pagina.waitForFunction(() => document.body.innerText.includes('Noite registrada'), { timeout: 10000 }),
      pagina.click('button[type=submit]'),
    ]);
  });

  // Issue #157: layout reage ao tamanho sem recarregar (media query), sem
  // duplicar a navegação no celular (menu do cabeçalho + barra inferior).
  await verificar.check('layout responsivo: celular sem menu duplicado, desktop sem barra', async () => {
    const estadoLayout = () => pagina.evaluate(() => {
      const cabecalho = document.querySelector('header');
      const linksCabecalho = cabecalho ? cabecalho.querySelectorAll('nav a').length : 0;
      const temBarra = Array.from(document.querySelectorAll('button'))
        .some((b) => (b.getAttribute('aria-label') || '') === 'Mais opções');
      return { linksCabecalho, temBarra };
    });

    await irPara('/dashboard');

    await pagina.setViewport({ width: 390, height: 844 });
    await dormir(300);
    const celular = await estadoLayout();
    if (celular.linksCabecalho !== 0) throw new Error(`cabeçalho com ${celular.linksCabecalho} link(s) no celular (390px)`);
    if (!celular.temBarra) throw new Error('barra inferior não apareceu no celular (390px)');

    // Alarga para desktop SEM recarregar: o layout deve mudar sozinho.
    await pagina.setViewport({ width: 1280, height: 800 });
    await dormir(300);
    const desktop = await estadoLayout();
    if (desktop.linksCabecalho === 0) throw new Error('cabeçalho sem links no desktop (1280px)');
    if (desktop.temBarra) throw new Error('barra inferior ainda aparece no desktop (1280px)');
  });

  await verificar.check('sair desloga', async () => {
    await irPara('/dashboard');
    await pagina.click('button[aria-label="Sair da conta"]');
    await pagina.waitForFunction(() => localStorage.getItem('token') === null, { timeout: 10000 });
    // Espera o app voltar ao estado de visitante (redirect + re-render).
    await pagina.waitForFunction(() => document.body.innerText.includes('Entrar'), { timeout: 10000 }).catch(() => {});
    const caminho = await pagina.evaluate(() => location.pathname);
    const t = await texto();
    if (caminho.startsWith('/dashboard')) throw new Error(`continuou em rota protegida após sair (${caminho})`);
    if (!/Entrar/i.test(t)) throw new Error(`cabeçalho não voltou a visitante (path=${caminho}, texto="${t.slice(0, 80)}")`);
  });

  await verificar.check('modo escuro mantém o texto legível', async () => {
    await pagina.evaluateOnNewDocument(() => localStorage.setItem('noiteboa.theme', 'dark'));
    await irPara('/login');
    const contraste = await pagina.evaluate(() => {
      const el = document.querySelector('h1') || document.body;
      const cor = getComputedStyle(el).color;
      let no = el;
      let fundo = 'rgba(0, 0, 0, 0)';
      while (no) {
        const c = getComputedStyle(no).backgroundColor;
        if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') { fundo = c; break; }
        no = no.parentElement;
      }
      const nums = (s) => s.match(/[\d.]+/g).map(Number);
      const lum = ([r, g, b]) => {
        const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const l1 = lum(nums(cor));
      const l2 = lum(nums(fundo));
      return { razao: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05), cor, fundo };
    });
    if (contraste.razao < 4.5) {
      throw new Error(`contraste ${contraste.razao.toFixed(2)}:1 abaixo de 4.5 (${contraste.cor} sobre ${contraste.fundo})`);
    }
  });

  falhas = verificar.falhas;
} catch (e) {
  console.error('erro fatal:', e.message);
} finally {
  if (pagina) await pagina.close().catch(() => {});
  if (navegador) await navegador.close().catch(() => {});
  if (servidor) servidor.kill('SIGTERM');
}

console.log(falhas ? `\n${falhas} cenário(s) com falha` : '\nTodos os cenários passaram');
process.exit(falhas ? 1 : 0);
