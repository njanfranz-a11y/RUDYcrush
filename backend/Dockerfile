FROM php:8.3-apache

# PHP extensions required by Laravel, Sanctum, dompdf and photo uploads.
# dom/fileinfo/xml are already compiled into the official image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libzip-dev \
        libpng-dev \
        libonig-dev \
        libxml2-dev \
        unzip \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql mbstring zip gd \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# The app accepts up to 5 photos of 5 MB each; PHP's defaults (2M/8M) reject them.
RUN printf '%s\n' \
    'upload_max_filesize = 12M' \
    'post_max_size = 40M' \
    'max_file_uploads = 10' \
    'memory_limit = 256M' \
    'max_execution_time = 120' \
    > /usr/local/etc/php/conf.d/roadwatch.ini

# Serve Laravel's public/ folder, not the application root.
RUN printf '%s\n' \
    '<VirtualHost *:80>' \
    '    DocumentRoot /var/www/html/public' \
    '    <Directory /var/www/html/public>' \
    '        AllowOverride All' \
    '        Require all granted' \
    '        Options -Indexes +FollowSymLinks' \
    '    </Directory>' \
    '    ErrorLog ${APACHE_LOG_DIR}/error.log' \
    '    CustomLog ${APACHE_LOG_DIR}/access.log combined' \
    '</VirtualHost>' > /etc/apache2/sites-available/000-default.conf

WORKDIR /var/www/html

# Dependencies first so they stay cached when only app code changes.
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-scripts --optimize-autoloader

COPY . .

RUN composer dump-autoload --optimize --no-dev \
    && php artisan package:discover --ansi \
    && mkdir -p \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/views \
        storage/logs \
        storage/app/public/accidents \
        bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R ug+rwX storage bootstrap/cache

COPY docker/entrypoint.sh /usr/local/bin/entrypoint
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint && chmod +x /usr/local/bin/entrypoint

ENTRYPOINT ["entrypoint"]
CMD ["apache2-foreground"]
