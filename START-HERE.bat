@echo off
title RoadWatch Bulacan - Launch
setlocal EnableExtensions

rem URL segment under htdocs = this folder's name
for %%I in ("%~dp0.") do set "FOLDER=%%~nxI"

rem Apache port, read from XAMPP's config (default 80)
set "PORT=80"
set "PORT_RAW="
set "HTTPD_CONF=C:\xampp\apache\conf\httpd.conf"
if exist "%HTTPD_CONF%" (
  for /f "tokens=2 delims= " %%P in ('findstr /b /i /c:"Listen " "%HTTPD_CONF%" 2^>nul') do (
    if not defined PORT_RAW set "PORT_RAW=%%P"
  )
)
if defined PORT_RAW for /f "tokens=2 delims=:" %%Q in ("%PORT_RAW%") do set "PORT=%%Q"
if "%PORT%"=="" set "PORT=80"

if "%PORT%"=="80" (
  set "URL=http://localhost/%FOLDER%/"
) else (
  set "URL=http://localhost:%PORT%/%FOLDER%/"
)

echo ============================================
echo   RoadWatch Bulacan - Local Launcher
echo ============================================
echo.

rem Warn if the project is not inside C:\xampp\htdocs
echo %~dp0 | find /I "\htdocs\" >nul
if errorlevel 1 (
  echo WARNING: This folder is not inside C:\xampp\htdocs\.
  echo Move the whole project folder into C:\xampp\htdocs\ and run this file again.
  echo.
  pause
  exit /b 1
)

rem Both XAMPP services must be up before the page can work
tasklist /fi "imagename eq httpd.exe" 2>nul | find /i "httpd.exe" >nul
if errorlevel 1 (
  echo Apache is not running.
  echo Start it in the XAMPP Control Panel, then double-click this file again.
  echo.
  if exist "C:\xampp\xampp-control.exe" start "" "C:\xampp\xampp-control.exe"
  pause
  exit /b 1
)

tasklist /fi "imagename eq mysqld.exe" 2>nul | find /i "mysqld.exe" >nul
if errorlevel 1 (
  echo MySQL is not running. Start it in the XAMPP Control Panel.
  echo The page that opens will keep saying so until it is up.
  echo.
  if exist "C:\xampp\xampp-control.exe" start "" "C:\xampp\xampp-control.exe"
)

echo Opening: %URL%
echo.
echo First run note: backend\.env is created and backend\database\RUDY.sql is
echo imported automatically when they are missing. Nothing else to configure.
echo.
start "" "%URL%"

endlocal
