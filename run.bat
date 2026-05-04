@echo off
REM Script para ejecutar el proyecto en Windows
REM Inicia el servidor y el cliente Vite automáticamente

echo.
echo ========================================
echo Gestion de Propiedades - Iniciando...
echo ========================================
echo.

REM Verificar que Node.js esté instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js no está instalado o no está en PATH
    echo Descargalo de: https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js detectado: 
node --version
echo npm detectado:
npm --version
echo.

REM Instalar dependencias si node_modules no existe
if not exist "node_modules\" (
    echo Instalando dependencias...
    call npm install
    if %errorlevel% neq 0 (
        echo Error al instalar dependencias
        pause
        exit /b 1
    )
)

echo.
echo Iniciando servidor y cliente...
echo.
echo Servidor: http://localhost:5000
echo Cliente:  http://localhost:3000
echo.
echo Presiona Ctrl+C para detener.
echo.

REM Iniciar el servidor en background y el cliente en foreground
start /b cmd /c npm run server
timeout /t 2 /nobreak
npm run client

REM Limpiar procesos si se interrumpe
echo.
echo Limpiando procesos...
taskkill /F /IM node.exe >nul 2>&1

pause
