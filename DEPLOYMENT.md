# Publicacao na VPS sem Docker

## Visao geral

Nesse modo de deploy:
- o frontend gerado pelo Vite fica em `/var/www/bolaocopa/current/dist`
- o backend administrativo (`/api/reset-password`) roda em Node na porta `4000`
- o Nginx faz HTTPS, serve o frontend e encaminha `/api/*` para o Node

## 1. Preparar a VPS

Instale Node.js 20+, Nginx e certbot.

Exemplo em AlmaLinux/CentOS:

```sh
dnf install -y nginx
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs
systemctl enable --now nginx
```

Crie a pasta da aplicacao:

```sh
mkdir -p /var/www/bolaocopa/current
```

## 2. Enviar os arquivos do projeto

No seu computador, envie o projeto para a VPS com `scp`, `rsync` ou Git.

Exemplo com `rsync`:

```sh
rsync -av --delete ./ usuario@SEU_IP:/var/www/bolaocopa/current/
```

## 3. Configurar variaveis de ambiente na VPS

Na VPS, crie o arquivo `/var/www/bolaocopa/current/.env.local` com:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_KEY=sua_service_role_key
```

## 4. Build da aplicacao

Na VPS:

```sh
cd /var/www/bolaocopa/current
npm ci
npm run build
```

## 5. Subir a API com systemd

Copie [deploy/bolaocopa.service](/c:/Antigravity/Bolaodacopa/project-fixed/deploy/bolaocopa.service) para:

```text
/etc/systemd/system/bolaocopa.service
```

Depois rode:

```sh
systemctl daemon-reload
systemctl enable --now bolaocopa
systemctl status bolaocopa
```

Teste a API localmente na VPS:

```sh
curl http://127.0.0.1:4000/api/health
```

## 6. Configurar Nginx

Copie [deploy/nginx-vps.conf](/c:/Antigravity/Bolaodacopa/project-fixed/deploy/nginx-vps.conf) para o Nginx, por exemplo:

```text
/etc/nginx/conf.d/bolaocopa.conf
```

Valide e recarregue:

```sh
nginx -t
systemctl reload nginx
```

## 7. SSL

Se o dominio `app.bolaocopa.inovaflowtec.com.br` ja aponta para a VPS, gere o certificado:

```sh
certbot --nginx -d app.bolaocopa.inovaflowtec.com.br
```

## 8. Atualizar a aplicacao

Sempre que publicar uma nova versao:

```sh
cd /var/www/bolaocopa/current
git pull
npm ci
npm run build
systemctl restart bolaocopa
nginx -t
systemctl reload nginx
```

## 9. Diagnostico rapido

Ver logs da API:

```sh
journalctl -u bolaocopa -n 100 --no-pager
```

Ver se a API esta no ar:

```sh
curl http://127.0.0.1:4000/api/health
```

Ver se o frontend foi gerado:

```sh
ls -la /var/www/bolaocopa/current/dist
```
