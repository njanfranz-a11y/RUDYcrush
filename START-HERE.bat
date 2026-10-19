@echo off
title RoadWatch Bulacan - Launch
setlocal

rem Derive this project's folder name (the URL segment under htdocs)
for %%I in ("%~dp0.") do set "FOLDER=%%~nxI"
set "URL=http://localhost/%FOLDER%/"

echo ============================================
echo   RoadWatch Bulacan - Local Launcher
echo ============================================
echo.
echo Before opening the app, make sure:
echo   1. Apache and MySQL are STARTED in the XAMPP Control Panel.
echo   2. The database was imported once via phpMyAdmin:
echo        http://localhost/phpmyadmin  -^>  Import
echo        file: backend\database\RUDY.sql
echo.
echo Opening: %URL%
echo.

rem Warn if the project is not inside C:\xampp\htdocs
echo %~dp0 | find /I "\htdocs\" >nul
if errorlevel 1 (
  echo WARNING: This folder does not appear to be inside C:\xampp\htdocs\.
  echo Move the whole project folder into C:\xampp\htdocs\ and run this file again.
  echo.
)

start "" "%URL%"

timeout /t 3 /nobreak >nul
endlocal
