====================================================================
RoadWatch Bulacan - Local Installation Guide (XAMPP)
====================================================================

This guide is written for a first-time user. The application is already
built and all PHP/JavaScript dependencies are included, so you do NOT need
Node.js, npm, Composer, or `php artisan serve` for normal use.

Project folder (as shared):  RUDYcrush
Location after copying:      C:\xampp\htdocs\RUDYcrush\
Website URL:                 http://localhost/RUDYcrush/
Database name:               accident_reporting_db
SQL file:                    backend\database\RUDY.sql

If you rename the project folder, use the new folder name in the URL.
Nothing else needs to change.

--------------------------------------------------------------------
STEP 1 - Install XAMPP
--------------------------------------------------------------------
1. Download XAMPP for Windows from https://www.apachefriends.org/
   Use a current XAMPP release with PHP 8.2 or newer (PHP 8.2.12 and
   MariaDB 10.4 were used to test this project).
2. Run the installer and install XAMPP to C:\xampp (the default).
3. Open the XAMPP Control Panel.

--------------------------------------------------------------------
STEP 2 - Start Apache and MySQL
--------------------------------------------------------------------
1. In the XAMPP Control Panel, click Start next to Apache.
2. Click Start next to MySQL.
3. Both should show a green "Running" status.

If Apache or MySQL will not start, see Troubleshooting below.

--------------------------------------------------------------------
STEP 3 - Copy the project into htdocs
--------------------------------------------------------------------
1. Copy the whole RUDYcrush folder into:
      C:\xampp\htdocs\
2. Confirm this file exists:
      C:\xampp\htdocs\RUDYcrush\index.php
   Do not copy only the files inside the folder, and do not double-nest
   it (for example C:\xampp\htdocs\RUDYcrush\RUDYcrush\ is wrong).

--------------------------------------------------------------------
STEP 4 - Import the database
--------------------------------------------------------------------
1. Open this address in your browser:
      http://localhost/phpmyadmin
2. Click the Import tab at the top.
3. Next to "File to import", click Choose File / Browse.
4. Select:
      C:\xampp\htdocs\RUDYcrush\backend\database\RUDY.sql
5. Leave the format as SQL and click Go / Import.
6. Wait for the success message.

What the SQL file does:
- Creates the database accident_reporting_db if it does not exist.
- Creates all application tables, keys, indexes, and relationships.
- Loads the demo accounts, categories, reports, history, and notifications.

Notes:
- You do NOT need to create the database first. The SQL file does it.
- The SQL file drops and recreates the application tables. If you already
  have data in accident_reporting_db that you want to keep, export a backup
  before importing this file.
- If phpMyAdmin reports a maximum upload size error, the file is not the
  problem; the SQL file is small. Make sure you selected RUDY.sql and not
  a ZIP file.

--------------------------------------------------------------------
STEP 5 - Check the database connection
--------------------------------------------------------------------
The connection is already configured for a standard XAMPP installation.
The file is:
      C:\xampp\htdocs\RUDYcrush\backend\.env

It contains:
      DB_CONNECTION=mysql
      DB_HOST=127.0.0.1
      DB_PORT=3306
      DB_DATABASE=accident_reporting_db
      DB_USERNAME=root
      DB_PASSWORD=

Normally you do not need to edit this file.

Edit backend\.env only if your XAMPP MySQL setup is different:
- If you set a MySQL root password, put it after DB_PASSWORD=.
- If MySQL runs on another port, change DB_PORT.
- Keep DB_DATABASE=accident_reporting_db unless you imported the SQL file
  into a database with a different name.

Do not add quotes around the password unless the password itself requires
them. Leave APP_KEY as it is: the included .env already has a valid key.

A template is also provided at backend\.env.example. If backend\.env is
missing, copy .env.example to .env, then generate a key from a terminal:
      C:\xampp\php\php.exe C:\xampp\htdocs\RUDYcrush\backend\artisan key:generate

--------------------------------------------------------------------
STEP 6 - Open the website
--------------------------------------------------------------------
Open this URL in Chrome, Edge, or Firefox:

      http://localhost/RUDYcrush/

The page should load the RoadWatch Bulacan landing page. API requests are
served from the same project through Apache at:
      http://localhost/RUDYcrush/backend/public/api/v1

You can also double-click START-HERE.bat in the project folder, which opens
the correct URL automatically.

--------------------------------------------------------------------
DEMO ACCOUNTS
--------------------------------------------------------------------
Role      Email                          Password
--------  -----------------------------  ----------------
Admin     admin@roadwatch.gov            AdminPass123!
Officer   officer.santos@traffic.gov     OfficerPass123!
Officer   officer.reyes@traffic.gov      OfficerPass123!
Citizen   maria.delacruz@gmail.com       ReporterPass123!
Citizen   juan.luna@gmail.com            ReporterPass123!

The login page also has Quick-Fill buttons for these accounts.

--------------------------------------------------------------------
TROUBLESHOOTING
--------------------------------------------------------------------
1. "This site can't be reached" / connection refused
   - Start Apache in the XAMPP Control Panel.
   - Check that no other program (IIS, Skype, another Apache) is using
     port 80. Stop it or change Apache's port in XAMPP.
   - Make sure the folder is directly inside C:\xampp\htdocs\.

2. The page loads but data does not (Unknown database / connection error)
   - Start MySQL in the XAMPP Control Panel.
   - Import backend\database\RUDY.sql again through phpMyAdmin.
   - Confirm backend\.env contains DB_DATABASE=accident_reporting_db,
     DB_USERNAME=root, DB_PASSWORD= (or your actual password).
   - If MySQL uses another port, update DB_PORT in backend\.env.

3. "Access denied for user 'root'@'localhost'"
   - You set a MySQL root password. Put that password in backend\.env
     after DB_PASSWORD= and save the file.

4. Port 3306 is already in use / MySQL will not start
   - Another MySQL/MariaDB service may be running. Stop it, or change the
     XAMPP MySQL port and set the same DB_PORT in backend\.env.

5. 404 Not Found at http://localhost/RUDYcrush/
   - The project folder is not directly in C:\xampp\htdocs\, or it is
     nested twice. The correct structure is:
         C:\xampp\htdocs\RUDYcrush\index.php
         C:\xampp\htdocs\RUDYcrush\frontend\dist\index.html
         C:\xampp\htdocs\RUDYcrush\backend\public\index.php

6. Blank page or "Loading RoadWatch..." forever
   - Open the browser developer tools (F12) and check the Console/Network
     tabs for failed API requests.
   - Confirm the API URL responds in the browser:
         http://localhost/RUDYcrush/backend/public/api/v1/categories
     It should return JSON, not an Apache 404 page.
   - If the API URL is a 404 in a fresh XAMPP install, make sure Apache's
     mod_rewrite module is enabled (it is enabled by default in XAMPP) and
     that AllowOverride All is set for C:\xampp\htdocs in httpd.conf.

7. 500 error / API error
   - Check:
         C:\xampp\htdocs\RUDYcrush\backend\storage\logs\laravel.log
   - Confirm these PHP extensions are enabled in C:\xampp\php\php.ini:
         pdo_mysql, mbstring, openssl, fileinfo, dom, zip
     They are enabled by default in a normal XAMPP installation.

8. Photos do not upload / display
   - Make sure Apache has write access to:
         C:\xampp\htdocs\RUDYcrush\backend\storage
   - The app serves photos through the API, so no storage symlink is needed.

9. Map tiles or fonts do not appear
   - The map, fonts, and Leaflet CSS load from the internet. Connect to the
     internet and reload the page. The rest of the site still works offline.

10. Login says the account is inactive
    - The account was deactivated by an administrator. Use one of the demo
      accounts above, or reactivate it from the Admin > Users page.

--------------------------------------------------------------------
IMPORTANT NOTES
--------------------------------------------------------------------
- This setup is for LOCAL development/classroom demonstration. Do not
  expose it to the public internet with debug mode and default accounts.
- The default credentials are intentionally simple. Change them if this
  project will be used outside a local machine.
- Do not run `php artisan migrate:fresh` after importing RUDY.sql unless
  you intend to erase and rebuild the database.
- The included frontend build (frontend/dist) is what runs under Apache.
  Node.js is only needed if you edit frontend source files and rebuild.
====================================================================
