<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'storage/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_filter([
        // Deployed frontend (Cloudflare Pages, Vercel, custom domain).
        env('FRONTEND_URL'),
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost',
        'http://127.0.0.1',
        'http://localhost:80',
        'http://127.0.0.1:80',
    ])),

    // Any localhost port, so a copy of the project still works when XAMPP's
    // Apache runs on 8080 instead of 80. FRONTEND_ORIGIN_PATTERN adds a regex
    // for preview deployments, e.g. '#^https://[a-z0-9-]+\.roadwatch\.pages\.dev$#'
    // ('supports_credentials' is true, so a bare "*" is not allowed).
    'allowed_origins_patterns' => array_values(array_filter([
        '#^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$#',
        env('FRONTEND_ORIGIN_PATTERN'),
    ])),

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];

