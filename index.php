<?php

/**
 * RoadWatch Bulacan - launcher.
 *
 * New machine, three steps:
 *   1. Copy this folder into C:\xampp\htdocs\
 *   2. Start Apache + MySQL from the XAMPP Control Panel
 *   3. Open http://localhost/<folder>/
 *
 * This file makes step 3 self-healing: it creates backend/.env when it is
 * missing (git clones never include it), imports backend/database/RUDY.sql
 * when the database has not been imported yet, and explains anything it cannot
 * fix in plain language instead of showing a blank page or a stack trace.
 *
 * Add ?setup=1 to see the checklist without being redirected.
 */

declare(strict_types=1);

$root = __DIR__;
$backend = $root . DIRECTORY_SEPARATOR . 'backend';
$envFile = $backend . DIRECTORY_SEPARATOR . '.env';
$envExample = $backend . DIRECTORY_SEPARATOR . '.env.example';
$sqlFile = $backend . DIRECTORY_SEPARATOR . 'database' . DIRECTORY_SEPARATOR . 'RUDY.sql';
$appUrl = 'frontend/dist/';
$distIndex = $root . DIRECTORY_SEPARATOR . 'frontend' . DIRECTORY_SEPARATOR . 'dist' . DIRECTORY_SEPARATOR . 'index.html';

$showSetup = isset($_GET['setup']);
$problems = [];
$notes = [];

/**
 * Minimal .env reader. Enough for the handful of DB_* values we need.
 */
function env_values(string $file): array
{
    $values = [];

    if (!is_file($file)) {
        return $values;
    }

    foreach (file($file, FILE_IGNORE_NEW_LINES) ?: [] as $line) {
        $line = trim($line);

        if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) {
            continue;
        }

        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);

        if (strlen($value) > 1 && ($value[0] === '"' || $value[0] === "'") && str_ends_with($value, $value[0])) {
            $value = substr($value, 1, -1);
        }

        $values[$key] = $value;
    }

    return $values;
}

/**
 * Restore the dump that ships with the project. It creates the database and
 * seeds the accounts, so a first run needs no phpMyAdmin visit.
 */
function import_sql(PDO $server, string $file): void
{
    $sql = file_get_contents($file);

    if ($sql === false || trim($sql) === '') {
        throw new RuntimeException('RUDY.sql is empty or unreadable.');
    }

    foreach (preg_split('/;[ \t]*\r?\n/', $sql) ?: [] as $statement) {
        $statement = trim($statement);

        if ($statement === '') {
            continue;
        }

        try {
            $server->exec($statement);
        } catch (PDOException $e) {
            // A chunk made only of comments has no query to run (MySQL 1065).
            // Everything else is a real problem and must surface.
            if (($e->errorInfo[1] ?? null) === 1065) {
                continue;
            }

            throw $e;
        }
    }
}

// -------------------------------------------------------------------------
// Checks
// -------------------------------------------------------------------------

if (!is_file($backend . '/vendor/autoload.php')) {
    $problems[] = 'backend/vendor is missing. Share the project as a ZIP of the whole folder '
        . '(a git clone leaves out vendor/) or run "composer install" inside backend/.';
}

if (!is_file($distIndex)) {
    $problems[] = 'The built frontend is missing (frontend/dist/). Share the project as a ZIP of the '
        . 'whole folder, or run "npm install" and "npm run build" inside frontend/.';
}

if (!extension_loaded('pdo_mysql')) {
    $problems[] = 'PHP is not loading the pdo_mysql extension. Enable it in C:\xampp\php\php.ini '
        . '(extension=pdo_mysql) and restart Apache.';
}

if (!is_file($envFile)) {
    if (!is_file($envExample)) {
        $problems[] = 'backend/.env and backend/.env.example are both missing. Restore them from the '
            . 'original copy of the project.';
    } else {
        $contents = file_get_contents($envExample) ?: '';
        $contents = preg_replace(
            '/^APP_KEY=.*$/m',
            'APP_KEY=base64:' . base64_encode(random_bytes(32)),
            $contents
        );

        if (@file_put_contents($envFile, $contents) === false) {
            $problems[] = 'Could not create backend/.env (permissions). Create it by copying '
                . 'backend/.env.example to backend/.env.';
        } else {
            $notes[] = 'Created backend/.env with a fresh APP_KEY.';
        }
    }
}

$env = env_values($envFile);
$dbHost = $env['DB_HOST'] ?? '127.0.0.1';
$dbPort = $env['DB_PORT'] ?? '3306';
$dbName = $env['DB_DATABASE'] ?? 'accident_reporting_db';
$dbUser = $env['DB_USERNAME'] ?? 'root';
$dbPass = $env['DB_PASSWORD'] ?? '';

$server = null;

try {
    $server = new PDO(
        sprintf('mysql:host=%s;port=%s', $dbHost, $dbPort),
        $dbUser,
        $dbPass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 5]
    );
} catch (Throwable $e) {
    $problems[] = 'Cannot reach MySQL on ' . $dbHost . ':' . $dbPort . '. Start MySQL in the XAMPP '
        . 'Control Panel, then reload this page.'
        . (str_contains($e->getMessage(), 'Access denied')
            ? ' (MySQL rejected the credentials in backend/.env: user "' . $dbUser . '". '
                . 'If your root account has a password, set DB_PASSWORD in backend/.env.)'
            : '');
}

if ($server !== null) {
    try {
        $exists = $server->query('SHOW DATABASES LIKE ' . $server->quote($dbName))->fetchColumn() !== false;
        $imported = false;

        if ($exists) {
            $check = $server->prepare(
                'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ? AND table_name = ?'
            );
            $check->execute([$dbName, 'users']);
            $imported = (int) $check->fetchColumn() > 0;
        }

        if (!$imported && is_file($sqlFile)) {
            import_sql($server, $sqlFile);
            $imported = true;
            $notes[] = 'Imported backend/database/RUDY.sql into "' . $dbName . '".';
        }

        if (!$imported) {
            $problems[] = 'The database "' . $dbName . '" has no tables and backend/database/RUDY.sql '
                . 'was not found. Import the SQL file through '
                . 'http://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . '/phpmyadmin/.';
        }
    } catch (Throwable $e) {
        $problems[] = 'Could not prepare the database: ' . $e->getMessage()
            . ' Import backend/database/RUDY.sql through '
            . 'http://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . '/phpmyadmin/ and reload.';
    }

    $server = null;
}

if (!is_writable($backend . '/storage')) {
    $notes[] = 'backend/storage is not writable, so photo uploads will fail. Give the folder write permission.';
}

if ($problems === [] && !$showSetup) {
    header('Location: ' . $appUrl);
    exit;
}

// -------------------------------------------------------------------------
// Setup / diagnostics page
// -------------------------------------------------------------------------

$escape = static fn (string $value): string => htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
$ready = $problems === [];
?><!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>RoadWatch - Setup</title>
    <style>
        :root { color-scheme: light; }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 32px 20px;
            background: #0f172a;
            font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
            color: #e2e8f0;
        }
        main {
            width: 100%;
            max-width: 620px;
            background: #111c33;
            border: 1px solid #1e293b;
            border-radius: 14px;
            padding: 28px;
        }
        h1 { margin: 0 0 6px; font-size: 22px; color: #fff; }
        p.lead { margin: 0 0 22px; color: #94a3b8; font-size: 14px; }
        h2 { margin: 22px 0 10px; font-size: 13px; text-transform: uppercase;
             letter-spacing: .08em; color: #64748b; }
        ul { margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.55; }
        li { margin-bottom: 10px; }
        li.bad { color: #fca5a5; }
        li.ok { color: #86efac; }
        a { color: #7dd3fc; }
        .actions { margin-top: 24px; display: flex; gap: 12px; flex-wrap: wrap; }
        .button {
            display: inline-block;
            padding: 10px 18px;
            border-radius: 8px;
            background: #e11d48;
            color: #fff;
            font-weight: 600;
            font-size: 14px;
            text-decoration: none;
        }
        .button.ghost { background: transparent; border: 1px solid #334155; color: #cbd5e1; }
        code { background: #1e293b; padding: 1px 5px; border-radius: 4px; font-size: 13px; }
    </style>
</head>
<body>
<main>
    <h1>RoadWatch Bulacan</h1>
    <p class="lead">
        <?= $ready
            ? 'Everything checks out. Open the app below.'
            : 'The app cannot start yet. Fix the items below, then reload this page.' ?>
    </p>

    <?php if ($notes !== []): ?>
        <h2>Done automatically</h2>
        <ul>
            <?php foreach ($notes as $note): ?>
                <li class="ok"><?= $escape($note) ?></li>
            <?php endforeach; ?>
        </ul>
    <?php endif; ?>

    <?php if ($problems !== []): ?>
        <h2>Needs attention</h2>
        <ul>
            <?php foreach ($problems as $problem): ?>
                <li class="bad"><?= $escape($problem) ?></li>
            <?php endforeach; ?>
        </ul>
    <?php endif; ?>

    <h2>Expected setup</h2>
    <ul>
        <li>The project folder sits inside <code>C:\xampp\htdocs\</code>.</li>
        <li>Apache and MySQL are running in the XAMPP Control Panel.</li>
        <li>Database <code>accident_reporting_db</code> exists (created automatically from
            <code>RUDY.sql</code> when missing).</li>
    </ul>

    <div class="actions">
        <?php if ($ready): ?>
            <a class="button" href="<?= $escape($appUrl) ?>">Open RoadWatch</a>
        <?php endif; ?>
        <a class="button ghost" href="?setup=1">Check again</a>
        <a class="button ghost" href="http://<?= $escape($_SERVER['HTTP_HOST'] ?? 'localhost') ?>/phpmyadmin/">phpMyAdmin</a>
    </div>
</main>
</body>
</html>
