@echo off
REM Development Script for Digonce (Windows)
REM Runs backend in Docker + frontend locally for instant hot reload

echo.
echo 🚀 Digonce Development Setup
echo ============================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not installed
    exit /b 1
)

echo ✓ Docker found
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed
    exit /b 1
)

echo ✓ Node.js found
echo.

REM Start Docker containers (DB + Backend)
echo Starting Database and Backend in Docker...
echo Run this in another terminal when ready:
echo.
echo   cd frontend ^&^& npm run dev
echo.

start cmd /k "docker compose up db backend"

REM Wait for backend to start
echo Waiting for backend to be ready...
timeout /t 5 /nobreak

:check_backend
curl -s http://localhost:8001/health >nul 2>&1
if errorlevel 1 (
    echo Checking backend...
    timeout /t 1 /nobreak
    goto check_backend
)

echo ✓ Backend is ready!
echo.
echo Starting Frontend with hot reload...
echo.

REM Start frontend
cd frontend
call npm run dev

pause
