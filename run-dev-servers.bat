@echo off
title RoadWatch Dev Servers
echo Starting RoadWatch BulSU Development Servers...

start "RoadWatch Laravel API (Port 8000)" cmd /k "cd backend && C:\xampp\php\php.exe artisan serve --port=8000"
start "RoadWatch React Vite (Port 5173)" cmd /k "cd frontend && npm run dev"

timeout /t 3 /nobreak >nul
start http://localhost:5173/

echo.
echo Servers running:
echo Frontend: http://localhost:5173/
echo Backend API: http://localhost:8000/api/v1
echo.
pause
