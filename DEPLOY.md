# Deploying RoadWatch (Cloudflare Pages + Railway)

The frontend is a static Vite build. The backend is Laravel + MySQL. They talk
over HTTPS, so CORS and an API URL (build-time or runtime) are required.

```text
Browser ──► Cloudflare Pages  (frontend/dist)
                │  XHR  https://<api>.up.railway.app/api/v1
                ▼
            Railway: Laravel (Apache + PHP 8.3) ──► Railway MySQL
                      │
                      └── Volume at /var/www/html/storage (photos, logs, APP_KEY)
```

Both sides are already prepared for this split:

- `backend/Dockerfile` builds Apache + PHP 8.3 with the required extensions.
- `backend/docker/entrypoint.sh` waits for MySQL, runs migrations, seeds the
  demo data once, creates an `APP_KEY` if you forgot one, and switches Apache
  to Railway's `$PORT`.
- `backend/railway.toml` uses `/up` as the health check.
- `frontend/public/_redirects` and `_headers` add the Cloudflare Pages SPA
  fallback and basic security/cache headers.
- `frontend/.nvmrc` pins Node 22 for the Pages build.

---

## 1. Backend on Railway

### 1a. Create the project

1. Push this repository to GitHub (or use the Railway CLI, see below).
2. In Railway: **New Project → Deploy from GitHub repo** → select the repo.
3. Open the Laravel service → **Settings → Source → Root Directory = `backend`**.
   Railway then picks up `backend/Dockerfile` and `backend/railway.toml`.
4. **New → Database → MySQL** in the same project. No public networking needed.
5. **Settings → Volumes → New Volume**, mounted at:
   ```text
   /var/www/html/storage
   ```
   This keeps uploaded photos, logs and the generated `APP_KEY` across
   redeploys. If you prefer to persist photos only, mount
   `/var/www/html/storage/app/public` instead, but then set `APP_KEY` yourself
   in Variables (otherwise the generated key changes on each deploy).

### 1b. Set the variables

On the Laravel service → **Variables**:

| Variable | Value |
| :--- | :--- |
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_URL` | `https://<your-service>.up.railway.app` (auto-detected if omitted) |
| `FRONTEND_URL` | `https://<your-project>.pages.dev` (no trailing slash) |
| `LOG_CHANNEL` | `stderr` |
| `DB_CONNECTION` | `mysql` |
| `DB_URL` | `${{MySQL.MYSQL_URL}}` |

For `DB_URL`, use Railway's variable picker (**Add Reference → MySQL →
MYSQL_URL**) instead of pasting a password. If your MySQL service has a
different name, use its name instead of `MySQL`.

Optional:

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `APP_KEY` | auto-generated | Set it if you want a fixed key or do not mount the whole storage folder. |
| `AUTO_MIGRATE` | `true` | Runs `php artisan migrate --force` on every container start. |
| `AUTO_SEED` | `true` | Runs the idempotent seeder (categories every boot, demo accounts/reports only on a fresh DB). |
| `FRONTEND_ORIGIN_PATTERN` | – | Extra wildcard origin regex, e.g. `#^https://[a-z0-9-]+\.roadwatch\.example\.com$#`. |

A complete copy is in `backend/.env.production.example`.

### 1c. Deploy

**Option A — GitHub:** Railway deploys automatically. Every push to the
connected branch redeploys.

**Option B — Railway CLI (upload the backend folder directly):**
```bash
railway login
railway link          # choose/create the project and service
railway up ./backend --path-as-root
```
`--path-as-root` makes `backend/` the Docker build context, so `Dockerfile`,
`composer.json` and `backend/railway.toml` are found at the archive root. If you
prefer, `cd backend` and run `railway up` instead.

With a CLI upload you do not need to set Railway's **Root Directory**; with the
GitHub integration you do (set it to `backend`).

### 1d. Networking and first boot

1. Service → **Settings → Networking → Generate Domain**.
2. Open `https://<your-service>.up.railway.app/up` — it must return `200 OK`.
   Allow up to a few minutes on the first deploy: the entrypoint is waiting for
   MySQL and running migrations.
3. Smoke-test the API:
   ```bash
   curl https://<your-service>.up.railway.app/api/v1/categories
   ```

The first boot creates the schema and the demo accounts. On later boots the
seeder only ensures the categories exist; it does **not** reset passwords or
re-create deleted accounts/reports.

> Change the demo admin password after your first login if the site is public.

### 1e. Host the Android APK

The web landing page downloads the current APK from the backend at:

```text
https://<your-service>.up.railway.app/downloads/RoadWatch-Bulacan.apk
```

Copy the built `Mobile app/RoadWatch-Bulacan.apk` to
`backend/public/downloads/RoadWatch-Bulacan.apk`, then deploy the backend as
usual (`cd backend && railway up --ci`). The APK is intentionally excluded from
git because release binaries are large; the Railway image keeps the copy.

The download button derives its URL from the frontend's configured API origin,
so `VITE_API_BASE_URL` must be set for the Pages build (see 2a). Apache adds the
Android MIME type and an attachment header via `backend/public/.htaccess`.

---

## 2. Frontend on Cloudflare Pages

### 2a. Build settings

**Workers & Pages → Create → Pages → Connect to Git** → same repository.

| Setting | Value |
| :--- | :--- |
| Framework preset | Vite |
| Root directory | `frontend` |
| Build command | `npm ci && npm run build` |
| Build output directory | `dist` |
| Node version | 22 (`.nvmrc` is included) |

Add an environment variable for **Production and Preview**:

```text
VITE_API_BASE_URL = https://<your-service>.up.railway.app/api/v1
```

Vite bakes this value into the build. The app also accepts the host URL without
`/api/v1` and appends it for you. Changing the variable requires a new
deployment, unless you edit `dist/config.js` (see 2b).

### 2b. Direct upload (no Git connection)

The build folder includes `config.js`, so you can set the API URL without
rebuilding:

```js
// frontend/dist/config.js (or frontend/public/config.js before a build)
window.__ROADWATCH_API_BASE_URL__ = 'https://<your-service>.up.railway.app/api/v1';
```

Then upload `frontend/dist` in the Cloudflare dashboard, or with Wrangler:

```powershell
cd frontend
npx wrangler pages deploy dist --project-name <your-pages-project>
```

If you prefer a fresh build:

```powershell
cd frontend
$env:VITE_API_BASE_URL = "https://<your-service>.up.railway.app/api/v1"
npm ci
npm run build
npx wrangler pages deploy dist --project-name <your-pages-project>
```

On macOS/Linux:

```bash
cd frontend
VITE_API_BASE_URL="https://<your-service>.up.railway.app/api/v1" npm ci
VITE_API_BASE_URL="https://<your-service>.up.railway.app/api/v1" npm run build
npx wrangler pages deploy dist --project-name <your-pages-project>
```

`config.js` wins over `VITE_API_BASE_URL`, which wins over auto-detection.
`npm run build` without either still produces a working XAMPP build (it
auto-detects `backend/public/api/v1`), but on Pages it would call
`https://<pages-domain>/api/v1`, which does not exist.

### 2c. Allow the Pages origin in Laravel

Copy the final `*.pages.dev` URL (or custom domain) into Railway's
`FRONTEND_URL` and redeploy the backend.

`config/cors.php` already allows any `https://*.pages.dev` origin, including
preview deployments, so the default production URL works even before you set
`FRONTEND_URL`. A custom domain must be added to `FRONTEND_URL` (comma-separate
multiple origins).

---

## 3. Verification checklist

- [ ] `GET /up` on Railway returns `200`
- [ ] `GET /api/v1/categories` returns JSON, not a 500
- [ ] Login with `admin@roadwatch.gov` / `AdminPass123!` from the Pages site
- [ ] Browser console shows no CORS or mixed-content errors
- [ ] Submit a report with a photo, reload, and confirm the photo still loads
- [ ] Redeploy the backend, then confirm the photo still loads (proves the
      volume is mounted correctly)
- [ ] Register a new citizen account and log in
- [ ] Open the incident map and the report form's map picker

---

## 4. Troubleshooting

| Symptom | Fix |
| :--- | :--- |
| Deploy fails at `composer install` or `COPY composer.json` | Railway's Root Directory is not `backend`. |
| `SQLSTATE[HY000] [2002]` / database unreachable | `DB_URL` is missing or does not reference the MySQL service. Check the variable picker and that both services are in the same project/environment. |
| `No application encryption key has been specified` | Set `APP_KEY`, or keep the storage volume mounted so the generated key persists. |
| 500 on `/api/v1/*` | Railway → Deploy Logs. `LOG_CHANNEL=stderr` prints Laravel errors there. For one deploy, set `APP_DEBUG=true`, reproduce, then turn it off. |
| CORS error in the browser | Add the exact Pages origin (scheme included, no trailing slash) to `FRONTEND_URL`, then redeploy the backend. |
| Frontend calls the Pages domain, or `/api/v1/*` returns 404 | No API URL was configured. Set `VITE_API_BASE_URL` in Pages, or edit `dist/config.js`, then redeploy the frontend. |
| Photos disappear after a redeploy | The volume is missing or mounted at the wrong path. Mount `/var/www/html/storage`. |
| Login works, then all requests return 401 after a redeploy | `APP_KEY` changed. Set a fixed `APP_KEY` or mount `/var/www/html/storage` so the generated key persists. |

Railway's free trial ends after **30 days or $5 of usage**. A Laravel + MySQL
pair is roughly **$4–7/month**, so plan on the **Hobby ($5/mo)** plan beyond
the trial.

---

## 5. Local XAMPP still works

None of this changes local development:

- `index.php` still imports `backend/database/RUDY.sql` on first run.
- `frontend/src/services/api.js` still auto-detects `backend/public/api/v1`
  under XAMPP when `VITE_API_BASE_URL` is not set.
- Localhost origins remain allowed by `backend/config/cors.php`.
