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
FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Sem privilegios de root: a imagem oficial ja traz o usuario "nginx"
# (uid 101), dono dos diretorios de cache/tempo do Nginx; conf.d tambem fica
# com ele para o entrypoint conseguir rodar, o "user" (no-op aqui) sai do
# config e o pid vai para /tmp porque /run e do root. Portas < 1024 exigiriam
# bind como root, por isso o container serve na 8080 (README: -p 8081:8080).
RUN chown -R nginx:nginx /var/cache/nginx /etc/nginx/conf.d \
 && sed -i -e '/^user[[:space:]]*nginx;/d' \
           -e 's|^pid .*;|pid /tmp/nginx.pid;|' /etc/nginx/nginx.conf

USER nginx

EXPOSE 8080
