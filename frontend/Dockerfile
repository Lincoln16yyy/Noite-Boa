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

# A base ja sobe como nginx (uid 101), entao o chown pede root so na hora:
# conf.d (diretorio E arquivo) com dono nginx, porque o entrypoint da base
# faz touch/sed no default.conf e loga "can not modify" toda subida sem isso.
USER root
RUN chown -R nginx:nginx /etc/nginx/conf.d
USER nginx

EXPOSE 8080
