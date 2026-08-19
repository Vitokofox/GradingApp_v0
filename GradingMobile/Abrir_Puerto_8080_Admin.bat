@echo off
:: Verificar si se ejecuta como administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Este script requiere privilegios de Administrador.
    echo Haz clic derecho en este archivo y selecciona "Ejecutar como administrador"
    pause
    exit /b 1
)

echo ============================================
echo   Configurando firewall para GradingApp
echo ============================================

:: Eliminar regla anterior si existe (para evitar duplicados)
netsh advfirewall firewall delete rule name="GradingApp Mobile Backend 8080" >nul 2>&1

:: Crear regla nueva
netsh advfirewall firewall add rule ^
    name="GradingApp Mobile Backend 8080" ^
    dir=in ^
    action=allow ^
    protocol=TCP ^
    localport=8080 ^
    description="Permite acceso al backend GradingApp desde telefono movil en la red local"

if %errorLevel% == 0 (
    echo.
    echo [OK] Puerto 8080 abierto correctamente en el Firewall de Windows.
    echo.
    echo Ahora el telefono podra conectarse usando: http://10.53.119.58:8080
    echo.
) else (
    echo [ERROR] No se pudo agregar la regla de firewall.
)

:: Verificar resultado
echo --- Reglas activas para puerto 8080 ---
netsh advfirewall firewall show rule name="GradingApp Mobile Backend 8080"

pause
