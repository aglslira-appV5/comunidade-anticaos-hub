#!/bin/sh

# Set environment variables for proper Python logging
export PYTHONUNBUFFERED=1
export PYTHONIOENCODING=utf-8

# Wait for database and redis if connection strings point to external services
# (In docker-compose, depends_on handles this, but useful for standalone)
if [ -n "$LEARNHOUSE_SQL_CONNECTION_STRING" ]; then
    DB_HOST=$(echo "$LEARNHOUSE_SQL_CONNECTION_STRING" | sed -n 's/.*@\([^:]*\):\([0-9]*\)\/.*/\1/p')
    if [ -n "$DB_HOST" ] && [ "$DB_HOST" != "localhost" ] && [ "$DB_HOST" != "127.0.0.1" ] && [ "$DB_HOST" != "db" ]; then
        echo "Waiting for external database at $DB_HOST..."
        timeout 30 sh -c 'until nc -z '"$DB_HOST"' 5432; do sleep 1; done' || true
    fi
fi

# Configura tranca da entrada direta (*.up.railway.app) no nginx (fase 1 - 144)
# Se INSPETOR_CHAVE estiver vazia, o endereço direto fica fechado para todos
if [ -z "$INSPETOR_CHAVE" ]; then
    CHAVE_NGINX="FECHADO_SEM_CHAVE_$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
else
    CHAVE_NGINX="$INSPETOR_CHAVE"
fi

CHAVE_NGINX_ESC=$(printf '%s\n' "$CHAVE_NGINX" | sed -e 's/[\/&|]/\\&/g')
for conf in /etc/nginx/http.d/default.conf /app/docker/nginx.conf; do
    if [ -f "$conf" ]; then
        sed -i "s|__INSPETOR_CHAVE__|$CHAVE_NGINX_ESC|g" "$conf"
    fi
done

# Configura tranca de origem (carimbo da Cloudflare X-Origem-Chave) no nginx (fase 2 - 147)
# Se ORIGEM_CHAVE estiver vazia -> fase 2 desligada (__ORIGEM_ATIVA__ = 0)
if [ -z "$ORIGEM_CHAVE" ]; then
    ORIGEM_ATIVA=0
    ORIGEM_CHAVE_VAL="DESLIGADA_$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
    echo "[tranca-origem] desligada"
else
    ORIGEM_ATIVA=1
    ORIGEM_CHAVE_VAL="$ORIGEM_CHAVE"
    echo "[tranca-origem] ligada"
fi

ORIGEM_CHAVE_ESC=$(printf '%s\n' "$ORIGEM_CHAVE_VAL" | sed -e 's/[\/&|]/\\&/g')
for conf in /etc/nginx/http.d/default.conf /app/docker/nginx.conf; do
    if [ -f "$conf" ]; then
        sed -i "s|__ORIGEM_ATIVA__|$ORIGEM_ATIVA|g" "$conf"
        sed -i "s|__ORIGEM_CHAVE__|$ORIGEM_CHAVE_ESC|g" "$conf"
    fi
done

# Start the services
# Use server-wrapper.js for runtime environment variable injection
pm2 start server-wrapper.js --cwd /app/web --name learnhouse-web > /dev/null 2>&1
pm2 start uv --cwd /app/api --name learnhouse-api -- run app.py
pm2 start node --cwd /app/collab --name learnhouse-collab -- dist/index.js

# Check if the services are running and log the status
pm2 status

# Start Nginx in the background
nginx -g 'daemon off;' &

# Tail PM2 logs with proper formatting
pm2 logs --raw
