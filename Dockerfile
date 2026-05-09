# Etapa 1: dependencias e build da aplicacao
FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# Etapa 2: instala apenas dependencias de producao para a API
FROM node:20-alpine AS production-deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Etapa 3: imagem final com Nginx + API Express
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache nginx \
  && mkdir -p /run/nginx /usr/share/nginx/html

COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist /usr/share/nginx/html
COPY package.json ./
COPY server.js ./server.js
COPY ./deploy/nginx-https.conf /etc/nginx/http.d/default.conf
COPY ./deploy/start.sh /start.sh

RUN chmod +x /start.sh

EXPOSE 80 443
CMD ["/start.sh"]
