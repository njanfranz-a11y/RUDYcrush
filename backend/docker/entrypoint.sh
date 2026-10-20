#!/bin/sh
# Railway routes traffic to $PORT and mounts the photo volume after the image
# is built, so both are handled here instead of in the Dockerfile.
set -e

if [ -n "$PORT" ]; then
    sed -ri "s/^Listen 80$/Listen ${PORT}/" /etc/apache2/ports.conf
    sed -ri "s/<VirtualHost \*:80>/<VirtualHost *:${PORT}>/" /etc/apache2/sites-available/000-default.conf
fi

mkdir -p \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    storage/app/public/accidents

# A freshly mounted volume is owned by root, which Apache (www-data) cannot write to.
chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rwX storage bootstrap/cache

if [ "$AUTO_MIGRATE" = "true" ]; then
    php artisan migrate --force --seed
fi

exec "$@"
