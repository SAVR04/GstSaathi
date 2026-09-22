@echo off
echo ========================================================
echo   Starting GST Copilot (AI-103 Course Project)
echo   Backend API:  http://localhost:8000
echo   Swagger Docs: http://localhost:8000/docs
echo   Frontend UI:  http://localhost:5173
echo ========================================================

start "GST Copilot Backend" cmd /k "cd /d %~dp0backend && .\venv\Scripts\uvicorn.exe main:app --reload --port 8000"
start "GST Copilot Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Servers launched in background windows! Press any key to close this launcher.
pause > nul
