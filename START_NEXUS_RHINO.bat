@echo off
title Nexus Rhino Bridge
echo ======================================================
echo             NEXUS RHINO BRIDGE (Windows)
echo ======================================================
echo.
echo Iniciando sistema...
cd /d "%~dp0"
if not exist "node_modules\" (
    echo Instalando paquetes de Node.js por primera vez...
    npm install --no-fund --no-audit
)
cmd /k "node nexus-rhino-server.js"
