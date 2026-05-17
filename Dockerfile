
# Dockerfile simplificado para usar build local
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache nginx \
  && mkdir -p /run/nginx /usr/share/nginx/html

COPY dist /usr/share/nginx/html
COPY package.json ./
COPY node_modules ./node_modules
COPY server.js ./server.js
COPY ./deploy/nginx-https.conf /etc/nginx/http.d/default.conf
COPY ./deploy/start.sh /start.sh

RUN chmod +x /start.sh

EXPOSE 80 443
CMD ["/start.sh"]
