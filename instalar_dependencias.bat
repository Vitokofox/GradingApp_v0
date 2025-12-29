@echo off
echo ==========================================
echo    Instalador de Dependencias GradingApp
echo ==========================================
echo.

:: Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python no esta instalado. Por favor instala Python 3.10+ y agregalo al PATH.
    pause
    exit /b
)
echo [OK] Python detectado.

:: Check for Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado. Por favor instala Node.js LTS.
    pause
    exit /b
)
echo [OK] Node.js detectado.

echo.
echo --- Configurando Backend ---
cd backend
if not exist venv (
    echo Creando entorno virtual...
    python -m venv venv
)
echo Instalando librerias Python...
venv\Scripts\pip install -r requirements.txt

echo.
echo --- Configurando Frontend ---
cd ..\frontend
echo Instalando librerias Node.js...
call npm install

echo.
echo ==========================================
echo    Instalacion Completada!
echo ==========================================
echo Ahora puedes usar 'Iniciar_Segundo_Plano.vbs'
pause
