#!/bin/sh
set -eu

export PORT="${PORT:-4000}"

node /app/server.js &

exec nginx -g 'daemon off;'
