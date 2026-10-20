# Deploying RoadWatch (Cloudflare Pages + Railway)

Frontend is a static Vite build; backend is Laravel + MySQL. The two hosts talk
over HTTPS, so CORS and a build-time API URL are required.

```text
Browser ──► Cloudflare Pages  (frontend/dist)
                │  XHR  https://<api>.up.railway.app/api/v1
                ▼
            Railway: Laravel (Apache + PHP 8.3) ──► Railway MySQL
                      │
                      └── Volume at /var/www/html/storage/app/public (photos)
```

---

## 1. Backend on Railway

1. **New Project → Deploy from GitHub repo** → `njanfranz-a11y/RUDYcrush`.
2. On the service, **Settings → Source → Root Directory = `backend`**.
   `backend/Dockerfile` and `backend/railway.toml` are picked up automatically.
3. **New → Database → MySQL** in the same project. No public networking needed.
4. **Settings → Volumes → New Volume**, mounted at:
   ```text
   /var/www/html/storage/app/public
   ```
   Without this every redeploy wipes uploaded accident photos.
5. **Variables** on the Laravel service (copy `backend/.env.production.example`):

   | Variable | Value |
   | :--- | :--- |
   | `APP_ENV` | `production` |
   | `APP_DEBUG` | `false` |
   | `APP_KEY` | `base64:...` (run `php artisan key:generate --show`) |
   | `APP_URL` | `https://<your-service>.up.railway.app` |
   | `FRONTEND_URL` | `https://<your-project>.pages.dev` (no trailing slash) |
   | `LOG_CHANNEL` | `stderr` |
   | `DB_CONNECTION` | `mysql` |
   | `DB_URL` | `${{MySQL.MYSQL_URL}}` |
   | `FILESYSTEM_DISK` | `public` |
   | `SESSION_DRIVER` | `database` |
   | `CACHE_STORE` | `database` |
   | `QUEUE_CONNECTION` | `database` |

   `DB_URL` is a reference variable — pick it from the MySQL service in the
   dropdown rather than pasting a password.
6. **Seed the database once**: service → **Shell**, then
   ```bash
   php artisan migrate --force --seed
   ```
   (Alternatively set `AUTO_MIGRATE=true` for one deploy, then set it back to
   `false`. Do not import `database/RUDY.sql` here — it starts with
   `CREATE DATABASE`/`USE`, which Railway's MySQL user cannot run.)
7. **Settings → Networking → Generate Domain**, then open
   `https://<your-service>.up.railway.app/up` — it must return `200 OK`.
8. Smoke-test the API:
   ```bash
   curl https://<your-service>.up.railway.app/api/v1/categories
   ```

Free trial note: the trial ends after **30 days or $5 of usage**. A Laravel +
MySQL pair runs about `$4–7/month`, so plan on **Hobby ($5/mo)** for anything
beyond that window.

---

## 2. Frontend on Cloudflare Pages

1. **Workers & Pages → Create → Pages → Connect to Git** → same repo.
2. Build settings:
   | Setting | Value |
   | :--- | :--- |
   | Framework preset | Vite |
   | Root directory | `frontend` |
   | Build command | `npm ci && npm run build` |
   | Build output directory | `dist` |
   | `NODE_VERSION` (env) | `22` |
3. Environment variable (Production **and** Preview):
   ```text
   VITE_API_BASE_URL = https://<your-service>.up.railway.app/api/v1
   ```
   Vite bakes this in at build time — changing it requires a new deployment.
   Without it the app falls back to `http://localhost:8000`.
4. Deploy, then copy the `*.pages.dev` URL into Railway's `FRONTEND_URL`
   variable and redeploy the backend so CORS allows it.

Preview deployments get a random `*.pages.dev` subdomain. Either add each one to
`FRONTEND_URL`/`FRONTEND_ORIGIN_PATTERN`, or test against the production URL.

---

## 3. Verify

- [ ] `GET /up` on Railway returns 200
- [ ] `GET /api/v1/categories` returns JSON (not a 500)
- [ ] Login with `admin@roadwatch.gov` / `AdminPass123!` from the Pages site
- [ ] Browser console shows no CORS or mixed-content errors
- [ ] Submit a report with a photo, reload, and confirm the photo still loads
- [ ] **Redeploy the backend, then confirm the photo still loads** (proves the
      volume is mounted correctly)

## 4. Local setup still works

These files only affect deployment; XAMPP keeps working as documented in
`README.txt`. `FRONTEND_URL` is optional locally, and localhost origins are
still allowed by `backend/config/cors.php`.

If something fails, check the Railway **Deploy Logs** first — Laravel's error
message is printed there because `LOG_CHANNEL=stderr`. For a blank page or a 500,
temporarily set `APP_DEBUG=true` and reload, then turn it back off.
