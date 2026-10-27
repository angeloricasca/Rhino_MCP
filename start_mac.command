#!/bin/bash
cd "$(dirname "$0")"

echo "======================================================"
echo "          RHINO MCP BRIDGE (macOS)"
echo "======================================================"
echo ""

# Leer puerto desde .env si existe, o usar 3000 por defecto
PORT=$(grep -E '^PORT=' .env 2>/dev/null | cut -d '=' -f2 | tr -d ' "\r')
PORT=${PORT:-3000}

# Liberar puerto si quedó ocupado por un proceso previo
OLD_PID=$(lsof -ti :$PORT)
if [ ! -z "$OLD_PID" ]; then
    echo "Liberando puerto $PORT de proceso anterior ($OLD_PID)..."
    kill -9 $OLD_PID 2>/dev/null
    sleep 1
fi

echo "Verificando dependencias..."
if [ ! -d "node_modules" ]; then
    echo "Instalando paquetes de Node.js..."
    npm install --no-fund --no-audit
fi

echo ""
echo "Iniciando servidor MCP en puerto $PORT..."
echo "Presiona Ctrl + C para detenerlo."
echo "======================================================"
echo ""

node nexus-rhino-server.js

echo ""
echo "El servidor se ha detenido."
read -p "Presiona Enter para cerrar esta ventana..."
