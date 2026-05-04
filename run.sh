#!/bin/bash

# Script para ejecutar el proyecto en Linux/Mac
# Inicia el servidor y el cliente Vite automáticamente

echo ""
echo "========================================"
echo "Gestion de Propiedades - Iniciando..."
echo "========================================"
echo ""

# Verificar que Node.js esté instalado
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js no está instalado"
    echo "Descargalo de: https://nodejs.org/"
    exit 1
fi

echo "Node.js detectado: $(node --version)"
echo "npm detectado: $(npm --version)"
echo ""

# Instalar dependencias si node_modules no existe
if [ ! -d "node_modules" ]; then
    echo "Instalando dependencias..."
    npm install
    if [ $? -ne 0 ]; then
        echo "Error al instalar dependencias"
        exit 1
    fi
fi

echo ""
echo "Iniciando servidor y cliente..."
echo ""
echo "Servidor: http://localhost:5000"
echo "Cliente:  http://localhost:3000"
echo ""
echo "Presiona Ctrl+C para detener."
echo ""

# Iniciar el servidor en background
npm run server &
SERVER_PID=$!

# Esperar un poco para que el servidor se inicie
sleep 2

# Iniciar el cliente en foreground
npm run client

# Limpiar procesos cuando se interrumpe
echo ""
echo "Limpiando procesos..."
kill $SERVER_PID 2>/dev/null
