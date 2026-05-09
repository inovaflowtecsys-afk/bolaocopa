#!/bin/sh
set -eu

APP_DIR="/var/www/bolaocopa/current"

cd "$APP_DIR"
npm ci
npm run build
sudo systemctl restart bolaocopa
sudo nginx -t
sudo systemctl reload nginx
