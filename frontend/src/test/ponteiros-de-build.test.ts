import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Guarda contra ponteiros órfãos deixados pela migração JS→TS (issue #264).
 *
 * Depois que `src/main.jsx` virou `src/main.tsx` e `src/setupTests.js` virou
 * `src/setupTests.ts` (issue #170, PR #197), o `index.html` e o `setupFiles` do
 * `vite.config.ts` continuaram apontando para os nomes antigos. O Vite resolve
 * `.jsx` → `.tsx` e `.js` → `.ts` por conta própria, então a falha não aparecia:
 * o build e a suíte seguiam verdes. Isso mascara o erro e pode quebrar numa
 * futura troca de bundler/versão.
 *
 * Dois cuidados aqui, por causa do review do PR #280: verificar apenas que o
 * arquivo existe não basta (apontar para outro arquivo existente, como
 * `src/setupTests.ts`, passaria); por isso cada ponteiro é comparado com o
 * caminho esperado **e** conferido em disco.
 *
 * O diretório de trabalho dos testes é `frontend/` (raiz do projeto Vite).
 */
const raiz = process.cwd();

/** Caminhos que o projeto espera de fato. Mudar aqui é uma decisão consciente. */
const ENTRY = '/src/main.tsx';
const SETUP_FILES = './src/setupTests.ts';

function semPontoInicial(caminho: string): string {
  return caminho.replace(/^\.\//, '').replace(/^\//, '');
}

function caminhoExiste(caminho: string): boolean {
  return existsSync(resolve(raiz, semPontoInicial(caminho)));
}

test('o index.html carrega o entry TypeScript esperado, e esse arquivo existe', () => {
  const html = readFileSync(resolve(raiz, 'index.html'), 'utf8');
  const src = html.match(/<script[^>]+src="([^"]+)"/)?.[1];

  expect(src).toBe(ENTRY);
  expect(caminhoExiste(src!)).toBe(true);
});

test('o setupFiles do Vite carrega o setup esperado, e esse arquivo existe', () => {
  const config = readFileSync(resolve(raiz, 'vite.config.ts'), 'utf8');
  const setupFiles = config.match(/setupFiles:\s*'([^']+)'/)?.[1];

  expect(setupFiles).toBe(SETUP_FILES);
  expect(caminhoExiste(setupFiles!)).toBe(true);
});
