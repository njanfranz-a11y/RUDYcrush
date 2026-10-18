# RoadWatch Bulacan &bull; Road Accident Reporting & Management System
**IT 305 &ndash; Advanced Web Development | Bulacan State University**

A complete, functional, secure, responsive, and validated web platform engineered for public road accident reporting, administrative review, and traffic officer dispatch.

---

## 1. System Architecture & Tech Stack

- **Frontend**: React 19 + Vite (JavaScript)
- **Styling**: Vanilla CSS Design System Tokens (Responsive Flex/Grid, Accessible WCAG-compliant contrasts)
- **Backend**: Laravel 12 REST API (`/api/v1`) using PHP 8.2
- **Authentication**: Laravel Sanctum token-based authentication with role-level abilities
- **Database**: Relational MySQL / MariaDB (Local XAMPP installation)
- **Database Administration**: phpMyAdmin
- **Geospatial Engine**: OpenStreetMap + Leaflet JS (Interactive map picker & multi-incident cluster viewer)
- **Document Exporting**: PDF generation via `barryvdh/laravel-dompdf` and CSV export with RFC 4180 formula-injection sanitization

---

## 2. Default Credentials & Role Accounts

The development database seeder automatically initializes realistic Bulacan incident records and the following verified accounts:

| Role | Email Address | Password | Permissions & Features |
| :--- | :--- | :--- | :--- |
| **Chief Administrator** | `admin@roadwatch.gov` | `AdminPass123!` | Dashboard analytics, report verification/rejection, officer dispatch, user role changes, audit logs, PDF & CSV exports. |
| **Traffic Officer 1** | `officer.santos@traffic.gov` | `OfficerPass123!` | Assigned cases queue, investigation remarks, actions taken, closing cases, badge: `PO3-8821`. |
| **Traffic Officer 2** | `officer.reyes@traffic.gov` | `OfficerPass123!` | Assigned cases queue, investigation remarks, badge: `PO2-4912`. |
| **Citizen Reporter 1** | `maria.delacruz@gmail.com` | `ReporterPass123!` | Public reporting, GPS map picker, photo uploads, personal report history, status notifications, supplementing active reports. |
| **Citizen Reporter 2** | `juan.luna@gmail.com` | `ReporterPass123!` | Public reporting, report tracking, personal profile editing. |

*(Note: The login page includes 1-click **Quick-Fill Demo Account** buttons to instantly test any role.)*

---

## 3. Installation & Local Setup Guide

### Prerequisites
1. **XAMPP**: Ensure Apache and MySQL are installed at `C:\xampp`.
2. **PHP 8.2+**: Located at `C:\xampp\php\php.exe`. Ensure `extension=zip` and `extension=pdo_mysql` are enabled in `php.ini`.
3. **Node.js**: v20+ and npm v10+.

### Step 1: Database Setup (import the provided SQL dump)
1. Start **MySQL** (and Apache) in XAMPP (Port `3306`).
2. Import the ready-made database via phpMyAdmin:
   - Open `http://localhost/phpmyadmin` and click **Import**.
   - Choose `backend/database/accident_reporting_db.sql` and click **Go**.
   - This creates `accident_reporting_db` with the schema and sample data.

   *(Alternative: create an empty database named `accident_reporting_db`
   (utf8mb4 / utf8mb4_unicode_ci) and run the migrations in Step 2.)*

### Step 2: Backend Setup (Laravel API)
1. Open a terminal in the `backend/` directory:
   ```powershell
   cd backend
   ```
2. The environment file `.env` is pre-configured for local MySQL:
   ```ini
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=accident_reporting_db
   DB_USERNAME=root
   DB_PASSWORD=
   FILESYSTEM_DISK=public
   ```
3. Run migrations and seed sample data:
   ```powershell
   php artisan migrate:fresh --seed
   ```
4. Create public storage symlink for uploaded evidence photos:
   ```powershell
   php artisan storage:link
   ```
5. Start the Laravel backend API server:
   ```powershell
   php artisan serve --port=8000
   ```
   *The API will be available at `http://localhost:8000/api/v1`.*

### Step 3: Frontend Setup (React + Vite)
1. In a separate terminal, navigate to `frontend/`:
   ```powershell
   cd frontend
   npm install
   ```
2. Start the Vite development server:
   ```powershell
   npm run dev -- --port 5173
   ```
3. Open your browser and navigate to:
   ```text
   http://localhost:5173
   ```

---

## 4. Automated Testing Suite

The backend contains automated PHPUnit feature tests verifying authentication, role access control, report submission, coordinate boundaries, date validation, and status transitions:

```powershell
cd backend
php vendor/bin/phpunit
```
**Results**: `10 tests, 32 assertions (100% Passing)`.

---

## 5. Controlled 8-Stage Status Workflow

Reports follow a strict state-machine enforced at the database and middleware level:
```text
[Submitted]
   │
   ├─► [Under Review] ◄──► [Additional Info Required]
   │         │
   │         ├─► [Rejected] (Requires recorded justification)
   │         │
   │         ▼
   └─► [Verified]
             │
             ├─► [Assigned] (Assigned to Traffic Officer)
             │        │
             │        ▼
             └─► [In Progress]
                      │
                      ▼
               [Closed / Resolved] (Requires findings & actions taken)
```

---

## 6. Mobile Application Phase (Future Milestone)

The REST API endpoints (`/api/v1/auth`, `/api/v1/reports`, `/api/v1/categories`, etc.) return normalized JSON and accept Bearer tokens via Laravel Sanctum. The future Flutter mobile application will communicate with this exact same backend and database without schema modifications.
