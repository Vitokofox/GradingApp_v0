@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "PYTHON_EXE=python"
set "PORTABLE_PYTHON=%~dp0.tools\python\cpython-3.12-windows-x86_64-none\python.exe"
set "PORTABLE_NODE=%~dp0.tools\node-v22.18.0-win-x64"
if exist "%PORTABLE_PYTHON%" set "PYTHON_EXE=%PORTABLE_PYTHON%"
if exist "%PORTABLE_NODE%\node.exe" set "PATH=%PORTABLE_NODE%;%PATH%"

echo [1/12] Validando Windows x64...
if /I not "%PROCESSOR_ARCHITECTURE%"=="AMD64" if /I not "%PROCESSOR_ARCHITEW6432%"=="AMD64" (
  echo ERROR: este build requiere Windows x64.
  exit /b 1
)

"%PYTHON_EXE%" --version >nul 2>&1 || (echo ERROR: Python Windows no esta disponible. & exit /b 1)
where node >nul 2>&1 || (echo ERROR: Node.js no esta disponible. & exit /b 1)
where npm >nul 2>&1 || (echo ERROR: npm no esta disponible. & exit /b 1)
"%PYTHON_EXE%" -c "import platform,struct,sys; sys.exit(0 if platform.system()=='Windows' and struct.calcsize('P')*8==64 else 1)" || (
  echo ERROR: Python debe ser una instalacion Windows x64.
  exit /b 1
)

echo [2/12] Instalando frontend con lockfile...
pushd frontend
call npm ci || (popd & exit /b 1)
echo [3/12] Ejecutando validacion frontend...
call npm run lint || (popd & exit /b 1)
echo [4/12] Compilando frontend...
call npm run build || (popd & exit /b 1)
popd
if not exist "frontend\dist\index.html" (echo ERROR: no se genero frontend\dist\index.html. & exit /b 1)

echo [5/12] Creando entorno virtual limpio de build...
if exist ".build_venv" rmdir /s /q ".build_venv"
"%PYTHON_EXE%" -m venv .build_venv || exit /b 1
call .build_venv\Scripts\python -m pip install --upgrade pip setuptools wheel || exit /b 1
call .build_venv\Scripts\python -m pip install -r backend\requirements-dev.txt pyinstaller || exit /b 1
call .build_venv\Scripts\python -m pip check || exit /b 1

echo [6/12] Ejecutando pruebas backend...
pushd backend
call ..\.build_venv\Scripts\python -m pytest -p no:cacheprovider --basetemp "%TEMP%\gradingapp_pytest" || (popd & exit /b 1)
popd

echo [7/12] Limpiando artefactos PyInstaller anteriores...
if exist "backend\build" rmdir /s /q "backend\build"
if exist "backend\dist" rmdir /s /q "backend\dist"

echo [8/12] Construyendo GradingApp onedir...
pushd backend
call ..\.build_venv\Scripts\python -m PyInstaller --clean --noconfirm GradingApp.spec || (popd & exit /b 1)
popd
if not exist "backend\dist\GradingApp\GradingApp.exe" (echo ERROR: PyInstaller no genero GradingApp.exe. & exit /b 1)

echo [9/12] Copiando recursos externos seguros...
xcopy "backend\models\all-MiniLM-L6-v2" "backend\dist\GradingApp\models\all-MiniLM-L6-v2\" /E /I /H /Y >nul || exit /b 1
mkdir "backend\dist\GradingApp\data\documentos" 2>nul
mkdir "backend\dist\GradingApp\data\vectorstore" 2>nul
copy /Y "backend\.env.example" "backend\dist\GradingApp\.env.example" >nul || exit /b 1

echo [10/12] Comprobando secretos y datos productivos...
if exist "backend\dist\GradingApp\.env" (echo ERROR: se intento incluir .env. & exit /b 1)
if exist "backend\dist\GradingApp\database\grading.db" (echo ERROR: se copio la base productiva. & exit /b 1)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$bad = Get-ChildItem 'backend\dist\GradingApp' -Recurse -Force -File | Where-Object { $_.Name -in @('.env','credentials.json','secrets.json') }; if ($bad) { $bad.FullName; exit 1 }" || (echo ERROR: se detectaron archivos de secretos. & exit /b 1)
for /R "backend\dist\GradingApp\data\documentos" %%F in (*) do (echo ERROR: documentos productivos incluidos: %%F & exit /b 1)
for /R "backend\dist\GradingApp\data\vectorstore" %%F in (*) do (echo ERROR: vectorstore productivo incluido: %%F & exit /b 1)

echo [11/12] Ejecutando smoke test y health check del EXE...
set "DATABASE_PATH=%TEMP%\gradingapp_smoke.db"
set "WAGNER_SERIAL_ENABLED=false"
if exist "%DATABASE_PATH%" del /q "%DATABASE_PATH%"
"backend\dist\GradingApp\GradingApp.exe" --smoke-test || exit /b 1
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p = Start-Process -FilePath 'backend\dist\GradingApp\GradingApp.exe' -WorkingDirectory 'backend\dist\GradingApp' -PassThru;" ^
  "$ok = $false; try { for ($i=0; $i -lt 60; $i++) { Start-Sleep -Seconds 1; try { $r=Invoke-RestMethod -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 2; if ($r.status -eq 'ok') { $ok=$true; break } } catch {} } } finally { if (!$p.HasExited) { Stop-Process -Id $p.Id -Force }; Wait-Process -Id $p.Id -ErrorAction SilentlyContinue }; if (!$ok) { exit 1 }" || (
  echo ERROR: fallo el health check del ejecutable.
  exit /b 1
)
if exist "%DATABASE_PATH%" del /q "%DATABASE_PATH%"

echo [12/12] Generando ZIP...
if exist "backend\dist\GradingApp_Windows_x64.zip" del /q "backend\dist\GradingApp_Windows_x64.zip"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path 'backend\dist\GradingApp' -DestinationPath 'backend\dist\GradingApp_Windows_x64.zip' -CompressionLevel Optimal" || exit /b 1

echo Build completado: backend\dist\GradingApp_Windows_x64.zip
exit /b 0
