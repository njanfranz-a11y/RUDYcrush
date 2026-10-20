# RoadWatch Bulacan — Running This System

This system runs on **MySQL/MariaDB (XAMPP)** and was tested with PHP 8.2.12
and MariaDB 10.4 on Windows.

## Quick start (3 steps)

1. Copy the **whole project folder** into `C:\xampp\htdocs\`.
2. Start **Apache** and **MySQL** in the XAMPP Control Panel.
3. Double-click **`START-HERE.bat`** (or open `http://localhost/RUDYcrush/`).
   If you renamed the project folder, use that name in the URL instead.

That is the whole setup. The launcher (`index.php`) handles the rest on first load:

- creates `backend/.env` with a fresh `APP_KEY` if the file is missing
  (a git clone never includes it),
- imports `backend/database/RUDY.sql` if the `accident_reporting_db` database
  has no tables yet — it creates the database and the sample data
  (5 accounts, 7 reports, 8 categories),
- shows a plain-English checklist at `http://localhost/RUDYcrush/?setup=1`
  instead of a blank page when Apache, MySQL or the credentials are off.

Log in with any seeded account (see `README.md`), e.g.
`admin@roadwatch.gov` / `AdminPass123!`.

After this, you can register new accounts, submit reports, upload photos, and
change statuses — everything is saved in MySQL.

### Importing the SQL by hand (optional)

The automatic import only runs when the database is empty, so importing first is
still fine:

- Open `http://localhost/phpmyadmin`, click **Import**, choose
  `backend/database/RUDY.sql`, click **Go**.

### Sharing the project

Share the **whole folder** (ZIP or USB), not a git clone: `frontend/dist`
(the built app) and `backend/vendor` (PHP packages) are git-ignored but required
to run. `node_modules` does not need to be included.

## What the target device needs

- XAMPP with **Apache** and **MySQL** running (PHP 8.2+).
- PHP extensions enabled by default in XAMPP: `pdo_mysql`, `mbstring`, `openssl`,
  `fileinfo`, `dom`. Nothing else.
- **No** Node.js and **no** Composer are required to run the app.

## How it works

- `index.php` (project root) is the launcher: it self-heals `backend/.env`,
  imports the SQL dump when needed, then redirects to `frontend/dist/`, the
  built React app (the build is already included).
- `frontend/src/services/api.js` auto-detects the API location from the page URL,
  so the app works from any folder name: the API is served from
  `<project-root>/backend/public/api/v1` through Apache.
- Uploaded photos are saved to `backend/storage/app/public/accidents/...` and
  served through the API (`/api/v1/photos/{id}/file`), so no `storage:link`
  symlink is needed.

## Database settings (`backend/.env`)

```
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=accident_reporting_db
DB_USERNAME=root
DB_PASSWORD=
```

## Rebuilding the database from scratch (optional)

Instead of importing the dump you can recreate it with migrations:

```powershell
cd backend
C:\xampp\php\php.exe artisan migrate:fresh --seed
```

Then re-export the SQL file if needed:

```powershell
C:\xampp\mysql\bin\mysqldump.exe -u root --databases accident_reporting_db --result-file="database\RUDY.sql"
```

## Running automated tests (optional, dev only)

Requires Node-free PHP only. Create the test database once, then run:

```powershell
C:\xampp\mysql\bin\mysql.exe -u root -e "CREATE DATABASE IF NOT EXISTS accident_reporting_db_testing;"
cd backend
C:\xampp\php\php.exe artisan test
```

## Development mode (optional)

Only needed if you want to edit the React code. Requires Node.js 20+.

```powershell
# Terminal 1 - backend API on port 8000
cd backend
C:\xampp\php\php.exe artisan serve --port=8000

# Terminal 2 - Vite dev server on port 5173
cd frontend
npm install
npm run dev
```

Then open `http://localhost:5173`. To ship changes, rebuild the static app:

```powershell
cd frontend
npm run build
```

## Troubleshooting

- **Setup page instead of the app:** it lists exactly what failed. Reload after
  fixing it, or open `http://localhost/RUDYcrush/?setup=1`.
- **"Cannot reach MySQL":** MySQL is not running, or `DB_HOST`/`DB_PORT` in
  `backend/.env` do not match your MySQL install.
- **"Access denied" from MySQL:** your root account has a password. Put it in
  `backend/.env` as `DB_PASSWORD=...`.
- **Photos not showing:** make sure `backend/storage` is writable.
- **Apache is on port 8080:** `START-HERE.bat` reads the port from
  `C:\xampp\apache\conf\httpd.conf`, or open
  `http://localhost:8080/RUDYcrush/` yourself.
