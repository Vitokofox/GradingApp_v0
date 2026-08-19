@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "PORTABLE_NODE=%~dp0.tools\node-v22.18.0-win-x64"
if exist "%PORTABLE_NODE%\node.exe" set "PATH=%PORTABLE_NODE%;%PATH%"

if not exist "backend\venv\Scripts\python.exe" (
    echo ERROR: No existe backend\venv. Ejecuta instalar_dependencias.bat primero.
    pause
    exit /b 1
)
where npm >nul 2>&1 || (
    echo ERROR: npm no esta disponible.
    pause
    exit /b 1
)

echo Starting Grading Web App...

:: Start Backend
start "Grading Backend" cmd /k "cd /d ""%~dp0backend"" && venv\Scripts\python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001"

:: Start Frontend
start "Grading Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev -- --host 0.0.0.0 --port 5174 --strictPort"

echo.
echo Application started!
echo Backend: http://localhost:8001
echo Frontend: http://localhost:5174
echo.
pause
