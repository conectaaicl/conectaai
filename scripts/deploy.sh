#!/bin/bash
# Deploy sin caida de ConectaAI Condominios / Ventas.
#   bash scripts/deploy.sh frontend   -> build + blue/green del frontend Next (condo, ventas, wildcard, gym)
#   bash scripts/deploy.sh backend    -> smoke estatico + build + recreate backend-condominios
#   bash scripts/deploy.sh all
# Blue/green: nginx apunta al upstream condo_frontend (3005 principal, 3015 backup). Antes de recrear el
# contenedor principal se levanta el nuevo build en 3015; nginx cae ahi mientras 3005 reinicia.
set -euo pipefail
ROOT=/var/www/conectaai
cd $ROOT
QUE=${1:-all}
GREEN=conectaai_frontend_green
log() { echo -e "\e[36m[deploy $(date +%H:%M:%S)] $*\e[0m"; }

esperar() {  # esperar <puerto> <segundos>
  for i in $(seq 1 "$2"); do
    c=$(curl -s -o /dev/null -m 3 -w '%{http_code}' -H 'Host: ventas.conectaai.cl' "http://127.0.0.1:$1/ventas/login" || true)
    [ "$c" = "200" ] && return 0
    sleep 1
  done
  return 1
}

if [ "$QUE" = backend ] || [ "$QUE" = all ]; then
  log "smoke estatico (compila 3.11 + rutas)"
  bash scripts/smoke.sh --static
  log "build backend-condominios"
  docker compose build backend-condominios
  docker compose up -d backend-condominios
  for i in $(seq 1 40); do curl -s -o /dev/null -m 2 http://127.0.0.1:8003/api/health && break; sleep 1; done
  log "backend arriba"
fi

if [ "$QUE" = frontend ] || [ "$QUE" = all ]; then
  log "build frontend"
  docker compose build frontend
  docker rm -f $GREEN >/dev/null 2>&1 || true
  log "levantando green en 3015 con la imagen nueva"
  docker run -d --name $GREEN --network cai_condominios_net -e PORT=3015 -p 127.0.0.1:3015:3015 conectaai-frontend:latest >/dev/null
  if ! esperar 3015 90; then
    log "green no respondio en 90 s: se aborta sin tocar produccion"; docker logs --tail 30 $GREEN; docker rm -f $GREEN; exit 1
  fi
  log "green sano; recreando 3005 (nginx usa 3015 mientras tanto)"
  docker compose up -d --force-recreate frontend
  esperar 3005 120 || { log "3005 no volvio; green sigue sirviendo en 3015 — revisar docker logs conectaai_frontend"; exit 1; }
  log "3005 sano; actualizando gym (3006)"
  (cd /var/www/gym && docker compose up -d) || true
  esperar 3006 60 || log "aviso: gym 3006 no respondio 200 (revisar)"
  sleep 5
  docker rm -f $GREEN >/dev/null
  log "green retirado"
fi

log "smoke completo"
bash scripts/smoke.sh || { log "SMOKE FALLO tras el deploy: revisar arriba"; exit 1; }
docker image prune -f >/dev/null 2>&1 || true
log "OK"
