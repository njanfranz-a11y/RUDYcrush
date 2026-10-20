#!/bin/sh
# Railway routes traffic to $PORT and mounts persistent storage after the
# image is built, so both are handled here instead of in the Dockerfile.
set -e

if [ -n "$PORT" ] && [ "$PORT" != "80" ]; then
    sed -ri "s/^Listen 80$/Listen ${PORT}/" /etc/apache2/ports.conf
    sed -ri "s/<VirtualHost \*:80>/<VirtualHost *:${PORT}>/" /etc/apache2/sites-available/000-default.conf
fi

mkdir -p \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    storage/app/public/accidents

# A freshly mounted volume is owned by root, which Apache (www-data) cannot
# write to. Creating the directories first also handles an empty volume.
chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rwX storage bootstrap/cache

# Laravel refuses to boot without APP_KEY. Railway users should still set it
# in Variables; this fallback keeps a first deploy working when they forget.
# The key is persisted in storage/app when the whole storage folder is mounted
# as a volume, so sessions and encrypted cookies survive a redeploy.
if [ -z "$APP_KEY" ]; then
    KEY_FILE="storage/app/.app_key"

    if [ -s "$KEY_FILE" ]; then
        APP_KEY="$(cat "$KEY_FILE")"
    else
        APP_KEY="base64:$(php -r 'echo base64_encode(random_bytes(32));')"
        printf '%s\n' "$APP_KEY" > "$KEY_FILE"
        chown www-data:www-data "$KEY_FILE"
    fi

    export APP_KEY
    echo "APP_KEY was not provided; using the generated key in $KEY_FILE."
fi

# Railway exposes the generated service domain. Use it when APP_URL is not set
# so URL generation is correct behind Railway's HTTPS proxy.
if [ -z "$APP_URL" ] && [ -n "$RAILWAY_PUBLIC_DOMAIN" ]; then
    export APP_URL="https://$RAILWAY_PUBLIC_DOMAIN"
fi

# MySQL on Railway can take a few seconds to accept connections after the
# service is created. Retry instead of failing the first deploy.
if [ "$AUTO_MIGRATE" != "false" ]; then
    attempt=1
    while ! php artisan migrate --force --no-interaction; do
        if [ "$attempt" -ge 15 ]; then
            echo "Database is still unreachable after 15 attempts. Check DB_URL." >&2
            exit 1
        fi

        echo "Migration failed; retrying in 3 seconds ($attempt/15)..."
        attempt=$((attempt + 1))
        sleep 3
    done

    # The seeder is idempotent: it ensures categories, and only creates the
    # demo accounts/reports on a brand-new database.
    if [ "$AUTO_SEED" != "false" ]; then
        php artisan db:seed --force --no-interaction
    fi
fi

exec "$@"
