@echo off
echo Deteniendo procesos del sistema...

echo Deteniendo Backend (Python Uvicorn)...
taskkill /F /IM python.exe /FI "WINDOWTITLE eq Backend*" 2>nul
:: Fallback generic kill if window title doesn't match background process behavior strictly
taskkill /F /IM python.exe /FI "COMMANDLINE eq *uvicorn*main:app*" 2>nul

echo Deteniendo Frontend (Node.js)...
taskkill /F /IM node.exe 2>nul

echo.
echo Aplicacion detenida.
pause
