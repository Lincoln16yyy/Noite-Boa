// Mede o layout desktop da issue #217 num navegador real.
//
// Prints mostram a aparência; aqui medimos a geometria, que é o que a issue
// pede: container único de 1100 px alinhado entre cabeçalho e conteúdo, grade
// de duas colunas a partir de 960 px, barra inferior só no celular.
//
// Uso: cd frontend && npm run build && npx vite preview --port 4173 &
//      cd tools/visual && node larguras.mjs
import puppeteer from 'puppeteer-core';
import { mocks } from './mocks.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const API_PORT = process.env.API_PORT || '8080';

/** As larguras que a issue manda conferir (768, 1280 e 1440) + o celular. */
const LARGURAS = [
  { nome: 'celular', width: 390, height: 844, isMobile: true },
  { nome: '768', width: 768, height: 900 },
  { nome: '1280', width: 1280, height: 900 },
  { nome: '1440', width: 1440, height: 900 },
];

/** Onde o container de 1100 px deve parar. */
const CONTAINER_MAX = 1100;
/** Ponto em que a grade vira de uma para duas colunas (layout.css). */
const LIMITE_GRADE = 960;

/**
 * Telas conferidas. /sons tem um só cartão (não há `.app-grade`), então o
 * critério de colunas é n/1 — o que importa é a largura da coluna legível.
 */
const TELAS = [
  { caminho: '/hoje', grade: 'sim' },
  { caminho: '/dashboard', grade: 'sim' },
  { caminho: '/configuracoes', grade: 'nao' },
  { caminho: '/sons', grade: 'nao' },
];

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

async function lancarNavegador() {
  if (process.env.CHROME_PATH) {
    return puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--no-sandbox'] });
  }
  const { default: chromium } = await import('@sparticuz/chromium');
  return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: 'shell' });
}

/**
 * @param {import('puppeteer').Browser} browser
 * @param {string} caminho
 * @param {{width: number, height: number, isMobile?: boolean}} vp
 */
async function medir(browser, caminho, vp) {
  const page = await browser.newPage();
  await page.setViewport(vp);
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.hostname === 'localhost' && u.port === API_PORT) {
      if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: cors });
      if (!req.headers().authorization) {
        return req.respond({ status: 401, contentType: 'application/json', headers: cors, body: '{"detail":"não autenticado"}' });
      }
      const corpo = mocks[u.pathname.replace(/^\/api/, '')];
      if (corpo !== undefined) {
        return req.respond({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(corpo) });
      }
      return req.respond({ status: 404, contentType: 'application/json', headers: cors, body: '{"detail":"mock não definido"}' });
    }
    return req.continue();
  });
  await page.evaluateOnNewDocument(() => localStorage.setItem('token', 'fake.jwt.token'));

  await page.goto(BASE + caminho, { waitUntil: 'networkidle0', timeout: 20000 });
  await new Promise((r) => setTimeout(r, 500));

  const leitura = await page.evaluate(() => {
    const caixa = (seletor) => {
      const el = document.querySelector(seletor);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right), largura: Math.round(r.width) };
    };
    const grade = document.querySelector('.app-grade');
    const trilhas = grade
      ? getComputedStyle(grade).gridTemplateColumns.split(' ').filter(Boolean)
      : [];
    const colunas = [...document.querySelectorAll('.app-grade > .app-coluna')].map((el) =>
      Math.round(el.getBoundingClientRect().width),
    );
    const navs = [...document.querySelectorAll('nav')];
    return {
      cabecalho: caixa('header .app-container'),
      conteudo: caixa('main.app-container'),
      // A coluna da tela é o que define a medida legível: o primeiro filho do
      // wrapper da rota (o div raiz de cada página).
      tela: caixa('.ui-screen-enter > *:first-child'),
      colunas,
      trilhas,
      menuCabecalho: Boolean(document.querySelector('header nav[aria-label="Navegação principal"]')),
      barraInferior: navs.some((n) => getComputedStyle(n).position === 'fixed'),
    };
  });
  await page.close();
  return leitura;
}

const browser = await lancarNavegador();
let falhas = 0;

/** Confere uma afirmação e registra a linha do relatório. */
function conferir(linha, ok, detalhe) {
  if (!ok) falhas += 1;
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${linha.padEnd(34)} ${detalhe}`);
}

for (const vp of LARGURAS) {
  for (const tela of TELAS) {
    const m = await medir(browser, tela.caminho, vp);
    const larguraEsperadaColunas = tela.grade === 'nao' ? null : vp.width >= LIMITE_GRADE ? 2 : 1;

    console.log(`\n=== ${tela.caminho} @ ${vp.nome} ===`);

    conferir(
      'container ≤ 1100 px',
      m.conteudo.largura <= CONTAINER_MAX,
      `conteúdo=${m.conteudo.largura}px`,
    );
    conferir(
      'cabeçalho e conteúdo alinhados',
      m.cabecalho.left === m.conteudo.left && m.cabecalho.right === m.conteudo.right,
      `esquerda ${m.cabecalho.left}/${m.conteudo.left} · direita ${m.cabecalho.right}/${m.conteudo.right}`,
    );
    // Abaixo do limite a coluna é legível (≤720 px); acima, as telas com
    // grade usam o container inteiro. Formulários ficam estreitos sempre.
    const tetoTela = tela.grade === 'sim' && vp.width >= LIMITE_GRADE ? CONTAINER_MAX : 720;
    conferir(
      `coluna da tela ≤ ${tetoTela} px`,
      m.tela.largura <= tetoTela,
      `tela=${m.tela.largura}px`,
    );
    if (larguraEsperadaColunas) {
      conferir(
        `${larguraEsperadaColunas} coluna(s) na grade`,
        m.trilhas.length === larguraEsperadaColunas,
        `trilhas=${m.trilhas.length} (${m.trilhas.join(' + ')}) · cartões=${m.colunas.join(' + ')}px`,
      );
    }
    conferir(
      'menu no cabeçalho só no desktop',
      m.menuCabecalho === !vp.isMobile,
      `menu=${m.menuCabecalho}`,
    );
    conferir(
      'barra inferior fixa só no celular',
      m.barraInferior === Boolean(vp.isMobile),
      `barra=${m.barraInferior}`,
    );
  }
}

await browser.close();
console.log(`\n${falhas ? `${falhas} falha(s)` : 'Container, colunas e navegação batem em todas as larguras conferidas.'}`);
process.exit(falhas ? 1 : 0);
