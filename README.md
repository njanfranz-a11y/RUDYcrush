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

> **For a beginner-friendly, step-by-step XAMPP guide, see [`README.txt`](README.txt).**
> The application is already built (`frontend/dist/`) and dependencies are included
> (`backend/vendor/`, `frontend/node_modules/`). Node.js and Composer are **not**
> required for normal local use.

### Prerequisites
1. **XAMPP**: Apache + MySQL/MariaDB installed at `C:\xampp` (PHP 8.2+).
2. The PHP extensions enabled by the standard XAMPP build: `pdo_mysql`, `mbstring`,
   `openssl`, `fileinfo`, `dom`, `zip`.

### Step 1: Copy the project into XAMPP
Copy the **whole project folder** into `C:\xampp\htdocs\`. This copy is named
`RUDYcrush`, so the site runs at:
```text
http://localhost/RUDYcrush/
```
If you rename the folder (for example to `RUDY`), the URL simply follows the new name.

### Step 2: Database Setup (import the provided SQL dump)
1. Start **Apache** and **MySQL** in the XAMPP Control Panel.
2. Open `http://localhost/phpmyadmin`.
3. Click **Import**, choose `backend/database/RUDY.sql`, and click **Go**.
4. The script creates the `accident_reporting_db` database (utf8mb4) with all tables,
   indexes, relationships, and the initial demo accounts/reports.

The connection in `backend/.env` is already configured for XAMPP:
```ini
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=accident_reporting_db
DB_USERNAME=root
DB_PASSWORD=
FILESYSTEM_DISK=public
```

### Step 3: Run the application
Open:
```text
http://localhost/RUDYcrush/
```
The root `index.php` forwards to the compiled React application, and the API is served
directly from `backend/public/api/v1` through Apache. Log in with any account from
Section 2.

### Optional: Development mode (React source edits)
Requires Node.js 20+; only needed if you change files in `frontend/src/`.
```powershell
# Terminal 1 - Laravel API on port 8000
cd backend
C:\xampp\php\php.exe artisan serve --port=8000

# Terminal 2 - Vite dev server on port 5173
cd frontend
npm install
npm run dev
```
Then open `http://localhost:5173`. Rebuild the static app after edits:
```powershell
cd frontend
npm run build
```

### Optional: Rebuilding the database from migrations
The SQL dump is the recommended setup. For development only, you can recreate the
schema with migrations instead:
```powershell
cd backend
C:\xampp\php\php.exe artisan migrate:fresh --seed
```

---

## 4. Automated Testing Suite

The backend contains automated PHPUnit feature tests verifying authentication, role access control, report submission, coordinate boundaries, date validation, and status transitions:

```powershell
cd backend
php vendor/bin/phpunit
```
**Results**: `100 tests, 435 assertions (100% passing)` on this copy.

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
