// E2E do primeiro uso (issue #215) contra a API de VERDADE — o mock dos
// screenshots não prova o que este prova: o `hasGoal` saindo do back, a sonda
// rodando depois do login e o indicador segurando o fluxo no reload.
//
// Pré-requisitos (nada de CI: é verificação manual, como os outros scripts):
//   docker compose up -d
//   cd backend  && mvn -B -DskipTests package && java -jar target/*.jar
//   cd frontend && npm ci && npm run dev          # vite em 5173
//   cd tools/visual && node primeiro-uso-e2e.mjs
//
// Cria uma conta nova a cada execução (e-mail com timestamp), percorre os 3
// passos e confere o que a issue pede: pula/aterrissa na Hoje e não mostra de
// novo. Use RATELIMIT_CADASTRO_LIMITE/RATELIMIT_LOGIN_LIMITE altos no back-end
// local: o limite de produção é 5 cadastros por hora por IP.
import puppeteer from 'puppeteer-core';

const APP = process.env.APP_URL || 'http://localhost:5173';
const API = process.env.API_URL || 'http://localhost:8080/api';
const email = `e2e-primeiro-uso-${Date.now()}@example.com`;
const falhas = [];
const confirma = (cond, msg) => {
  console.log(`${cond ? 'ok  ' : 'FALHA'} ${msg}`);
  if (!cond) falhas.push(msg);
};

async function lancar() {
  if (process.env.CHROME_PATH) {
    return puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--no-sandbox'] });
  }
  const { default: chromium } = await import('@sparticuz/chromium');
  return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: 'shell' });
}

const browser = await lancar();
const page = await browser.newPage();
const puts = [];
page.on('request', (r) => {
  if (r.method() === 'PUT' && r.url().includes('/api/goal')) puts.push(JSON.parse(r.postData() || '{}'));
});

const espera = (fn, ms = 15000) => page.waitForFunction(fn, { timeout: ms });
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

/** Clica só quando o botão existe E está habilitado (o `loading` do PUT anterior o desabilita). */
const clicar = async (texto) => {
  await page.waitForFunction(
    (alvo) => {
      const botao = [...document.querySelectorAll('button')].find((el) => el.textContent.includes(alvo));
      return Boolean(botao) && !botao.disabled;
    },
    { timeout: 15000 },
    texto,
  );
  await page.click(`button ::-p-text(${texto})`);
};

// 1. Cadastro de conta nova: sem noite e sem meta. O app manda para /login
//    depois de criar a conta, então entramos em seguida.
await page.goto(`${APP}/cadastro`, { waitUntil: 'networkidle0' });
const inputs = await page.$$('form input');
await inputs[0].type('E2E Primeiro Uso');
await inputs[1].type(email);
await inputs[2].type('senha-de-teste-123');
await page.click('form button[type="submit"]');
await espera(() => location.pathname === '/login');
confirma(true, `cadastro (${email}) criou a conta e foi para /login`);

await page.$$('form input').then(async (camposLogin) => {
  await camposLogin[0].type(email);
  await camposLogin[1].type('senha-de-teste-123');
});
await page.click('form button[type="submit"]');
await espera(() => location.pathname === '/onboarding');
confirma(true, 'login de conta nova caiu em /onboarding');

// 2. Passo 1: meta de 7h → PUT /goal com targetMinutes. O /onboarding entra
//    depois que a sonda responde, então esperamos o passo renderizar.
await page.waitForSelector('input[type=range]', { timeout: 15000 });
// React controla o valor do input: atribuição direta é ignorada, então
// passamos pelo setter nativo do protótipo e disparamos o evento de verdade.
await page.$eval('input[type=range]', (el) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, '7');
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await clicar('Avançar');
await espera(() => document.body.textContent.includes('Qual é o seu horário'));
confirma(puts.length === 1 && puts[0].targetMinutes === 420, 'passo 1 salvou { targetMinutes: 420 }');

// 3. Passo 2: horários → o segundo PUT leva bedtime/wakeTime.
await page.waitForSelector('input[type="time"]', { timeout: 15000 });
const campos = await page.$$('input[type="time"]');
await campos[0].type('23:30');
await campos[1].type('06:45');
await clicar('Avançar');
await espera(() => document.body.textContent.includes('Sobre lembretes'));
confirma(
  puts.length === 2 && puts[1].bedtime === '23:30' && puts[1].wakeTime === '06:45',
  'passo 2 salvou { targetMinutes: 420, bedtime: "23:30", wakeTime: "06:45" }',
);

// 4. Passo 3: termina na Hoje e marca o indicador no aparelho.
await clicar('Começar a registrar');
await espera(() => location.pathname === '/hoje');
const marcador = await page.evaluate(() => localStorage.getItem('noiteboa.onboarding-concluido'));
confirma(marcador === '1', 'passo 3 terminou em /hoje com o indicador marcado');

// 5. Não mostra de novo: recarrega e espera a sessão.
await page.reload({ waitUntil: 'networkidle0' });
await pausa(2500);
confirma(
  (await page.evaluate(() => location.pathname)) === '/hoje',
  'reload mantém /hoje (não volta ao onboarding)',
);

// 6. O caso que motivou `hasGoal`: MESMA conta, indicador apagado, mas meta já
//    salva no servidor. Sem o campo, o app reabriria o fluxo.
await page.evaluate(() => localStorage.removeItem('noiteboa.onboarding-concluido'));
await page.goto(`${APP}/hoje`, { waitUntil: 'networkidle0' });
await pausa(2500);
confirma(
  (await page.evaluate(() => location.pathname)) === '/hoje',
  'sem indicador mas COM meta salva → fica na Hoje (é o que hasGoal resolve)',
);

// 7. Quem já registrou uma noite também não volta ao fluxo. A noite entra pela
//    API com o MESMO token da sessão do navegador, para exercitar a sonda real.
const token = await page.evaluate(() => localStorage.getItem('token'));
const registro = await page.evaluate(
  async (t, api) => {
    const fim = new Date(Date.now() - 3600e3);
    const ini = new Date(fim.getTime() - 7 * 3600e3);
    const r = await fetch(`${api}/sleep-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ sleepStart: ini.toISOString(), sleepEnd: fim.toISOString(), quality: 4 }),
    });
    return r.status;
  },
  token,
  API,
);
confirma(registro === 201, `noite registrada pela API real (status ${registro})`);

await page.evaluate(() => localStorage.removeItem('noiteboa.onboarding-concluido'));
await page.goto(`${APP}/hoje`, { waitUntil: 'networkidle0' });
await pausa(2500);
confirma(
  (await page.evaluate(() => location.pathname)) === '/hoje',
  'sem indicador e COM noite registrada → fica na Hoje',
);

await browser.close();
console.log(`\nPUT /goal observados: ${JSON.stringify(puts)}`);
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nfluxo ponta a ponta com API real: tudo ok');
process.exit(falhas.length ? 1 : 0);
