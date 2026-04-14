#!/bin/bash

# Script para configurar HTTPS com Let's Encrypt na VPS

docker rm -f bolaocopa-web 2>/dev/null || true
sleep 2

# Gerar certificado
certbot certonly \
  --standalone \
  -d app.bolaocopa.inovaflowtec.com.br \
  --non-interactive \
  --agree-tos \
  --email admin@inovaflowtec.com.br

# Executar container com volumes dos certificados
docker run -d \
  --name bolaocopa-web \
  --restart unless-stopped \
  -p 80:80 \
  -p 443:443 \
  -v /opt/apps/bolaocopa/dist:/usr/share/nginx/html:ro \
  -v /opt/apps/bolaocopa/deploy/nginx-https.conf:/etc/nginx/conf.d/default.conf:ro \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  nginx:alpine

echo "Container iniciado com HTTPS!"
curl -s https://app.bolaocopa.inovaflowtec.com.br -k | head -30
