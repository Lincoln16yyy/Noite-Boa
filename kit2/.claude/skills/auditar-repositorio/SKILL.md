---
name: auditar-repositorio
description: Audita o código deste repositório (back-end Spring Boot e front-end React) e entrega um relatório honesto, com evidências, por gravidade. Use quando pedirem para analisar, revisar ou checar bugs no projeto ou em um PR.
---

# Auditar o repositório

Objetivo: dizer a verdade sobre o estado do código, com provas, sem inventar e sem exagerar.

## 1. Descubra o que dá para verificar
- Anote o commit (`git log -1 --format='%h %ad %s'`).
- Rode o que for possível e registre o resultado: `cd frontend && npm ci && npm run lint && npm test && npm run build`; `cd backend && mvn -B verify` (precisa de Postgres; se não der, diga que não rodou).
- Liste o que NÃO deu para rodar. Isso entra no relatório.

## 2. Leia nesta ordem
1. `PLANO.md`, `AGENTS.md`, `README.md` (o que o produto promete).
2. Config e segurança: `application*.yml`, `SecurityConfig`, `JwtService`, filtros, `GlobalExceptionHandler`.
3. Serviços e controllers de cada módulo (`auth`, `sleep`, `stats`, `goal`, `friends`), depois migrações `db/migration`.
4. Testes: o que cobrem e o que afirmam (um teste pode estar "certificando" um comportamento errado).
5. Front: `api/client.js`, `App.jsx`, rotas protegidas, cada página, `lib/`.
6. Infra: `Dockerfile`, workflows, `render.yaml`, `vercel.json`, service worker.

## 3. Procure estas classes de problema
**Back-end**
- Autorização: todo recurso filtra pelo usuário autenticado? Recurso de outro usuário dá 404?
- Validação: entrada inválida vira 4xx? (`PageRequest.of(-1, …)` e parâmetros fora do intervalo costumam virar 500.)
- Exceções: o handler genérico engole erros de entrada como 500? A stack é logada sem vazar dados pessoais?
- Dados: consulta que carrega tudo e filtra em memória; N+1; falta de índice; corrida (dois pedidos juntos) contra restrição de unicidade.
- Tempo: fuso horário, "hoje" ainda sem dados, janelas de datas, virada de dia.
- Regras de negócio: o número exibido faz sentido para um usuário novo, para um usuário perfeito e para um usuário sem dados?
- Segurança: limite de tentativas, enumeração de contas (mensagens e tempo de resposta), segredos, CORS.

**Front-end**
- Efeitos sem cancelamento (resposta antiga sobrescrevendo a nova), duplo clique, estados de carregando/erro/vazio.
- Fuso/data do navegador versus o do servidor.
- Falha de rede ou servidor "acordando": existe timeout e mensagem útil?
- Acessibilidade: contraste, alvos de toque de 44 px, rótulos, foco visível.
- Consistência com `docs/identidade-visual.md` (cores, links, fonte).

## 4. Valide cada achado antes de relatar
- Releia as linhas citadas. Existe teste que o cobre? O teste concorda ou contradiz?
- Classifique: **confirmado**, **provável** ou **hipótese**. Hipótese não vira bug.
- Se achou algo que contradiz o que você disse antes, corrija explicitamente.

## 5. Formato do relatório
1. Resumo de duas frases e o que foi/não foi verificado.
2. O que está bom (curto, com fatos).
3. Problemas por gravidade (alta, média, baixa): título, `arquivo:linha`, impacto, certeza, correção sugerida.
4. Ordem recomendada de correção.
5. Para cada problema aceito pelo dono, uma issue no formato de `.github/seed/issues-v2/` (Contexto, Tarefas, Critérios de aceite, Fora do escopo).

Não corrija nada durante a auditoria, a menos que peçam. Auditar e consertar são tarefas separadas.
