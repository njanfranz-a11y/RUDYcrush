# RoadWatch Bulacan — Running This System

This system runs on **MySQL/MariaDB (XAMPP)** and was tested with PHP 8.2.12
and MariaDB 10.4 on Windows. The database is provided as an importable SQL file:

```
backend/database/RUDY.sql
```

Import it into phpMyAdmin once, and the app is ready to use.

## Run on any Windows + XAMPP device

1. Copy the **whole project folder** into `C:\xampp\htdocs\`.
2. Open the **XAMPP Control Panel** and start **Apache** and **MySQL**.
3. Import the database:
   - Open `http://localhost/phpmyadmin` in a browser.
   - Click **Import** at the top.
   - Choose the file `backend/database/RUDY.sql`.
   - Click **Go**.
   - This creates the `accident_reporting_db` database and loads the sample data
     (5 accounts, 7 reports, 8 categories).
4. Double-click **`START-HERE.bat`** (or open `http://localhost/RUDYcrush/`).
   If you renamed the project folder, use that name in the URL instead.

Log in with any seeded account (see `README.md`), e.g.
`admin@roadwatch.gov` / `AdminPass123!`.

After this, you can register new accounts, submit reports, upload photos, and
change statuses — everything is saved in MySQL.

## What the target device needs

- XAMPP with **Apache** and **MySQL** running (PHP 8.2+).
- PHP extensions enabled by default in XAMPP: `pdo_mysql`, `mbstring`, `openssl`,
  `fileinfo`, `dom`. Nothing else.
- **No** Node.js and **no** Composer are required to run the app.

## How it works

- `index.php` (project root) redirects to `frontend/dist/`, the built React app
  (the build is already included).
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

- **Blank page / 404 at the URL:** Apache is not running, or the folder is not
  under `C:\xampp\htdocs\`. `START-HERE.bat` prints a warning if misplaced.
- **API errors ("Unknown database"):** MySQL is not running, or the
  `backend/database/RUDY.sql` file was not imported yet.
- **Photos not showing:** make sure `backend/storage` is writable.
