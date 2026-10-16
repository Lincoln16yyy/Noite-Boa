# syntax=docker/dockerfile:1

# ---- Etapa 1: build estatico do front-end ----
FROM node:24-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# URL da API e embutida no build (Vite nao le variaveis em tempo de execucao)
ARG VITE_API_URL=http://localhost:8080/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- Etapa 2: serve os arquivos com Nginx (SPA) ----
# Variante "unprivileged" da imagem oficial do Nginx: ja roda como nginx
# (uid 101, sem root), serve na 8080 e expoe SO a 8080. A variante normal
# expoe a 80 e esse EXPOSE herdado nao da para remover (EXPOSE so soma), o
# que deixaria um "docker run -P" publicando uma porta morta. Bind em 8080
# nao exige root; no README: docker run -p 8081:8080.
FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# A base unprivileged deixa /etc/nginx gravavel pelo uid 101 (para o
# entrypoint funcionar como usuario comum) — daria para o nginx reescrever a
# propria configuracao num pos-comprometimento (CWE-732): o arquivo root-owned
# seria desvinculado pelo diretorio pai gravavel. Trava tudo em root:root sem
# escrita para o servico; em troca o entrypoint loga um unico "info: can not
# modify ... default.conf" por subida (inofensivo e esperado para config que
# nao e a de fabrica). /var/cache/nginx (fora de /etc/nginx) continua gravavel
# de proposito: e onde o Nginx grava os arquivos temporarios.
USER root
RUN chown -R root:root /etc/nginx && chmod -R go-w /etc/nginx
USER nginx

EXPOSE 8080
