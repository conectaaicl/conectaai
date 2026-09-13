#!/bin/bash
# Smoke test pre-deploy de ConectaAI Condominios / Ventas.
#   bash scripts/smoke.sh            -> compila (py3.11) + chequeo estatico + chequeo dinamico contra lo que corre hoy
#   bash scripts/smoke.sh --static   -> solo compila + estatico (no toca la BD)
# Sale con codigo != 0 si algo falla. Correrlo ANTES de `docker compose build`.
set -u
ROOT=/var/www/conectaai
BACK=$ROOT/condominios/backend/app
API=http://127.0.0.1:8003
FRONT=http://127.0.0.1:3005
FAIL=0
rojo() { echo -e "\e[31m✗ $*\e[0m"; FAIL=1; }
ok()   { echo -e "\e[32m✓ $*\e[0m"; }

echo "== 1. Compilacion con Python 3.11 (la version del contenedor)"
if docker run --rm -v "$BACK":/chk python:3.11-alpine python -m compileall -q /chk >/tmp/smoke_compile.log 2>&1; then ok "backend compila"; else rojo "backend NO compila:"; cat /tmp/smoke_compile.log; fi

echo "== 2. Rewrites: todo prefijo /api/ usado por el frontend tiene destino"
node -e "
const r=require('$ROOT/frontend/next.config.js');r.rewrites().then(list=>{
 const last=list[list.length-1]; if(last.source!=='/api/:path*'||!last.destination.includes('backend-condominios')){console.error('fallback /api/:path* no apunta a backend-condominios');process.exit(1)}
 console.log(list.length+' rewrites, fallback -> '+last.destination)})" && ok "rewrites" || rojo "rewrites"

echo "== 3. Tenant hardcodeado en frontend/backend"
H=$(grep -rnE 'tenant_id *(\|\||\?\?) *[1-9]|TENANT_ID *= *[1-9]|tenant_id *[:=] *[1-9][0-9]*[,;) ]' --include=*.ts --include=*.tsx --include=*.py "$ROOT/frontend/app" "$BACK/routers" 2>/dev/null | grep -v 'node_modules\|_test\|== 1:\|tenant_id == 1' || true)
if [ -z "$H" ]; then ok "sin tenant hardcodeado"; else rojo "tenant hardcodeado:"; echo "$H"; fi

echo "== 4. Rutas de navegacion vs paginas y fetch('/api/..') vs backend (estatico)"
python3 "$ROOT/scripts/audit_static.py" > /tmp/smoke_static.log 2>&1
if grep -qE 'sin pagina: \[|^  /' /tmp/smoke_static.log; then rojo "hallazgos estaticos:"; grep -E 'sin pagina: \[|^  /' /tmp/smoke_static.log | head -20; else ok "navegacion y fetch consistentes"; fi

[ "${1:-}" = "--static" ] && { echo; [ $FAIL = 0 ] && echo "SMOKE OK (estatico)" || echo "SMOKE FALLO"; exit $FAIL; }

echo "== 5. Dinamico: login admin temporal (tenant 10, plantilla) y GET de cada endpoint del sidebar"
PW="Smoke!$(date +%s)"
HASH=$(docker exec conectaai_backend_condominios python -c "import bcrypt;print(bcrypt.hashpw(b'$PW',bcrypt.gensalt()).decode())")
docker exec conectaai_db psql -U conectaai_user -d conectaai -q -c "INSERT INTO usuarios (email,password_hash,nombre_completo,rol,activo,tenant_id) VALUES ('smoke@test.local','$HASH','Smoke Test','admin',true,10) ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash, activo=true, tenant_id=10"
trap 'docker exec conectaai_db psql -U conectaai_user -d conectaai -q -c "DELETE FROM usuarios WHERE email='"'"'smoke@test.local'"'"'" ; rm -f /tmp/smoke.jar' EXIT
curl -s -c /tmp/smoke.jar -o /dev/null -w '' -X POST $API/api/auth/login -d "email=smoke@test.local&password=$PW"
if ! grep -q session /tmp/smoke.jar; then rojo "login admin fallo"; exit 1; fi
# Todos los GET sin parametros de ruta que declara la app (se mantiene solo). 401/403/422 = permisos/params (ok); 5xx = roto.
docker exec conectaai_backend_condominios python -c "
from app.main import app
skip=('/api/cron','/api/demo','/api/invitacion','/api/ventas-terreno/p/','/api/ventas-terreno/cortinas/p/','/api/ventas-terreno/negocios/p/','/api/ventas-terreno/pres/','/api/ventas-terreno/publico','/api/superadmin','/api/noc','/api/migracion','/api/scanner','/api/biometrico')
for r in app.routes:
    p=r.path
    if 'GET' in (getattr(r,'methods',None) or ()) and '{' not in p and p.startswith('/api') and not p.startswith(skip): print(p)
" 2>/dev/null | sort -u > /tmp/smoke_endpoints.txt
N=0; B=0
[ -s /tmp/smoke_endpoints.txt ] || rojo "no se pudo leer openapi.json del backend"
while read -r e; do
  [ -z "$e" ] && continue; N=$((N+1))
  c=$(curl -s -m 20 -b /tmp/smoke.jar -o /tmp/smoke_body -w '%{http_code}' "$API$e")
  case $c in 5*|000) rojo "$e -> $c $(head -c 120 /tmp/smoke_body)"; B=$((B+1));; esac
done < /tmp/smoke_endpoints.txt
[ $B = 0 ] && ok "$N endpoints GET sin 5xx" || rojo "$B de $N endpoints con 5xx"

echo "== 6. Paginas del frontend responden (200) con sesion"
for p in /dashboard /dashboard/condominios/personas /dashboard/condominios/gastos-comunes /dashboard/condominios/visitas /conserje /portal /ventas/login; do
  c=$(curl -s -b /tmp/smoke.jar -o /tmp/smoke_body -w '%{http_code}' -H 'Host: condo.conectaai.cl' "$FRONT$p")
  case $c in 200|307|308) ;; *) rojo "pagina $p -> $c";; esac
  grep -q 'Application error' /tmp/smoke_body && rojo "pagina $p: Application error"
done
ok "paginas responden"

echo
[ $FAIL = 0 ] && echo "SMOKE OK" || echo "SMOKE FALLO"
exit $FAIL
