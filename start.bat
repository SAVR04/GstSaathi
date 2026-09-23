@echo off
echo ========================================================
echo   Starting GSTSaathi - Enterprise AI Tax Platform
echo   Backend API:  http://localhost:8001
echo   Swagger Docs: http://localhost:8001/docs
echo   Frontend UI:  http://localhost:5173
echo ========================================================

start "GSTSaathi Backend" cmd /k "cd /d "%~dp0" && .\backend\venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8001"
start "GSTSaathi Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Both Backend and Frontend launched! Opening http://localhost:5173 ...
timeout /t 2 >nul
start http://localhost:5173
