#!/bin/bash

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Iniciando ConectaAI...${NC}"

# Matar procesos previos
pkill -9 -f "uvicorn.*8000"
pkill -9 -f "uvicorn.*8001"
pkill -9 -f "next"
sleep 2

# Backend CORE (puerto 8000)
echo -e "${GREEN}✅ Iniciando Backend CORE :8000${NC}"
cd /opt/conectaai/backend
source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/backend-core.log 2>&1 &
deactivate

# Backend Ventas (puerto 8001)
echo -e "${GREEN}✅ Iniciando Backend Ventas :8001${NC}"
cd /opt/conectaai/ventas/backend
source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8001 > /tmp/backend-ventas.log 2>&1 &
deactivate

# Frontend (puerto 3000)
echo -e "${GREEN}✅ Iniciando Frontend :3000${NC}"
cd /opt/conectaai/frontend
nohup npm run start > /tmp/frontend.log 2>&1 &

sleep 5

echo -e "${BLUE}📊 Estado de servicios:${NC}"
curl -s http://localhost:8000/ > /dev/null && echo -e "${GREEN}✅ Backend CORE :8000 OK${NC}" || echo -e "❌ Backend CORE :8000 FAIL"
curl -s http://localhost:8001/ > /dev/null && echo -e "${GREEN}✅ Backend Ventas :8001 OK${NC}" || echo -e "❌ Backend Ventas :8001 FAIL"
curl -s http://localhost:3000/ > /dev/null && echo -e "${GREEN}✅ Frontend :3000 OK${NC}" || echo -e "❌ Frontend :3000 FAIL"

echo -e "${BLUE}✨ ConectaAI iniciado!${NC}"
echo -e "📝 Logs en /tmp/backend-*.log y /tmp/frontend.log"
echo -e "🌐 Acceso: https://conectaai.cl"
