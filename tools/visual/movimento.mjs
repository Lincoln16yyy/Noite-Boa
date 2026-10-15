// Prova as animações da issue #216 num navegador real (issue #216).
//
// Prints estáticos não mostram movimento, então aqui medimos o que o navegador
// de fato anima: `document.getAnimations()` devolve as animações CSS agendadas
// nos elementos. Rodamos duas vezes — com e sem `prefers-reduced-motion` — e
// comparamos. É a prova direta do critério de aceite "animações visíveis em
// movimento normal e ausentes com a preferência ligada".
//
// Uso: cd frontend && npm run build && npx vite preview --port 4173 &
//      cd tools/visual && node movimento.mjs
import puppeteer from 'puppeteer-core';
import { mocks } from './mocks.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const API_PORT = process.env.API_PORT || '8080';
const OUT = new URL('./out/', import.meta.url).pathname;

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

async function lancarNavegador() {
  if (process.env.CHROME_PATH) {
    return puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--no-sandbox'] });
  }
  const { default: chromium } = await import('@sparticuz/chromium');
  return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: 'shell' });
}

/**
 * Abre uma tela logada e mede o movimento.
 *
 * Duas medições, porque `getAnimations()` só devolve animações ainda em
 * execução (as terminadas saem da lista, já que nenhuma usa `forwards`):
 *
 * 1. `picoAtivas` — amostramos a cada frame desde a navegação e guardamos o
 *    maior número de animações agendadas sob cada seletor. É a prova de que a
 *    animação **chegou a rodar**.
 * 2. `animationName` — o valor computado depois de assentar. Prova que a regra
 *    CSS está **aplicada** (ou `none`, quando o sistema pede menos movimento).
 *
 * @param {import('puppeteer').Browser} browser
 * @param {string} caminho - rota a abrir
 * @param {boolean} menosMovimento - se deve emular prefers-reduced-motion
 */
async function medir(browser, caminho, menosMovimento) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  if (menosMovimento) {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  }
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.hostname === 'localhost' && u.port === API_PORT) {
      if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: cors });
      if (!req.headers().authorization) {
        return req.respond({ status: 401, contentType: 'application/json', headers: cors, body: '{"detail":"não autenticado"}' });
      }
      const rota = u.pathname.replace(/^\/api/, '');
      const corpo = mocks[rota];
      if (corpo !== undefined) {
        return req.respond({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(corpo) });
      }
      return req.respond({ status: 404, contentType: 'application/json', headers: cors, body: '{"detail":"mock não definido"}' });
    }
    return req.continue();
  });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('token', 'fake.jwt.token');
    // Amostra a cada frame e guarda o pico de animações por seletor, para não
    // depender de termos lido "na hora certa" depois do networkidle0.
    window.__pico = {};
    const ALVOS = ['.ui-ring__value', '.ui-progress__fill', '.ui-bar-grow', '.ui-screen-enter'];
    const amostrar = () => {
      for (const seletor of ALVOS) {
        const qtd = [...document.querySelectorAll(seletor)].reduce((t, el) => t + el.getAnimations().length, 0);
        if (qtd > (window.__pico[seletor] ?? 0)) window.__pico[seletor] = qtd;
      }
      requestAnimationFrame(amostrar);
    };
    requestAnimationFrame(amostrar);
  });

  await page.goto(BASE + caminho, { waitUntil: 'networkidle0', timeout: 20000 });
  // Deixa qualquer animação remanescente terminar antes de ler o estado final.
  await new Promise((r) => setTimeout(r, 700));

  const leitura = await page.evaluate(() => {
    const nomes = (seletor) =>
      [...new Set([...document.querySelectorAll(seletor)].map((el) => getComputedStyle(el).animationName))].join(',') || '(sem elemento)';
    return {
      pico: window.__pico ?? {},
      nome: {
        anel: nomes('.ui-ring__value'),
        barraProgresso: nomes('.ui-progress__fill'),
        barrasGrafico: nomes('.ui-bar-grow'),
        tela: nomes('.ui-screen-enter'),
      },
    };
  });
  await page.close();
  return leitura;
}

/**
 * Mede a contagem do número de destaque (o único caso que anima por
 * `requestAnimationFrame` e não por CSS, então não aparece em getAnimations).
 *
 * Amostra o texto do número a cada frame e devolve os valores distintos vistos:
 * no movimento normal a sequência passa por vários valores até o final; com
 * reduced-motion nasce já no valor final, sem passar por nenhum intermediário.
 *
 * @param {import('puppeteer').Browser} browser
 * @param {boolean} menosMovimento
 */
async function medirContagem(browser, menosMovimento) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  if (menosMovimento) {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  }
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
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('token', 'fake.jwt.token');
    window.__amostras = [];
    const ver = () => {
      const el = document.querySelector('.ui-ring .display-number');
      if (el) window.__amostras.push(el.textContent);
      requestAnimationFrame(ver);
    };
    requestAnimationFrame(ver);
  });

  await page.goto(BASE + '/hoje', { waitUntil: 'networkidle0', timeout: 20000 });
  // Espera passar da duração da contagem (600 ms) para ler o valor assentado.
  await new Promise((r) => setTimeout(r, 900));
  const leitura = await page.evaluate(() => {
    const el = document.querySelector('.ui-ring .display-number');
    return {
      distintos: [...new Set(window.__amostras)],
      final: el?.textContent,
      // O nome acessível precisa ter o valor real desde o primeiro render
      // (role=img + aria-label ficam no <svg>, filho de .ui-ring).
      rotuloAnel: document.querySelector('.ui-ring svg')?.getAttribute('aria-label'),
    };
  });
  await page.close();
  return leitura;
}

const browser = await lancarNavegador();
let falhas = 0;

// O anel (.ui-ring__value) só existe na tela Hoje; as barras do gráfico e a
// barra de progresso aparecem no Dashboard (e a troca de tela, nas duas).
const telas = [
  ['/hoje', ['anel', 'tela']],
  ['/dashboard', ['barraProgresso', 'barrasGrafico', 'tela']],
];

for (const [caminho, alvos] of telas) {
  const comMovimento = await medir(browser, caminho, false);
  const semMovimento = await medir(browser, caminho, true);

  console.log(`\n=== ${caminho} ===`);
  for (const alvo of alvos) {
    const seletor = { anel: '.ui-ring__value', barraProgresso: '.ui-progress__fill', barrasGrafico: '.ui-bar-grow', tela: '.ui-screen-enter' }[alvo];
    const picoLigado = comMovimento.pico[seletor] ?? 0;
    const picoDesligado = semMovimento.pico[seletor] ?? 0;
    const nomeLigado = comMovimento.nome[alvo];
    const nomeDesligado = semMovimento.nome[alvo];
    // Critério: a animação roda (pico > 0) e tem nome de keyframe no modo
    // normal; com reduced-motion não roda (pico 0) e o nome vira `none`.
    const ok = picoLigado > 0 && picoDesligado === 0 && nomeDesligado === 'none';
    if (!ok) falhas += 1;
    console.log(
      `${ok ? 'ok  ' : 'FALHA'} ${alvo.padEnd(14)} normal: pico=${picoLigado} nome=${nomeLigado} · reduced-motion: pico=${picoDesligado} nome=${nomeDesligado}`,
    );
  }
}

// Contagem do número de destaque: por rAF, então mede os valores amostrados.
console.log('\n=== /hoje · contagem do número ===');
const contagemNormal = await medirContagem(browser, false);
const contagemReduzida = await medirContagem(browser, true);
for (const [rotulo, leitura] of [['movimento normal', contagemNormal], ['reduced-motion', contagemReduzida]]) {
  console.log(`    ${rotulo.padEnd(17)} valores distintos: ${leitura.distintos.length} · ${leitura.distintos.slice(0, 3).join(' → ')}${leitura.distintos.length > 3 ? ' → … → ' + leitura.distintos.at(-1) : ''}`);
  console.log(`    ${' '.repeat(18)} final: ${leitura.final} · aria-label do anel: ${leitura.rotuloAnel}`);
}
// Normal: conta (vários valores) e assenta no final. Reduzido: nasce no
// final, sem nenhum intermediário. O aria-label é sempre o valor real.
const okContagem =
  contagemNormal.distintos.length > 3 &&
  contagemNormal.final === contagemNormal.distintos.at(-1) &&
  contagemReduzida.distintos.length === 1 &&
  contagemReduzida.final === contagemReduzida.distintos[0] &&
  contagemReduzida.rotuloAnel === contagemNormal.rotuloAnel;
if (!okContagem) falhas += 1;
console.log(`${okContagem ? 'ok  ' : 'FALHA'} contagem       conta no movimento normal, nasce no valor final com reduced-motion`);

await browser.close();
console.log(`\n${falhas ? `${falhas} falha(s)` : 'Todas as animações ligam no movimento normal e desligam com prefers-reduced-motion.'}`);
process.exit(falhas ? 1 : 0);
