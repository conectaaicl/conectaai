"""Auditoria estatica del frontend condo: links de navegacion vs paginas, y fetch('/api/..') vs backend (condominios + core)."""
import re, os, glob, json, subprocess, urllib.request
os.chdir('/var/www/conectaai/frontend')
APP = 'app'
pages = set()
for f in glob.glob(f'{APP}/**/page.tsx', recursive=True):
    rel = f[len(APP):-len('/page.tsx')]
    rel = re.sub(r'/\([^)]+\)', '', rel)  # route groups
    pages.add(rel or '/')
def page_exists(href):
    p = href.split('?')[0].split('#')[0].rstrip('/') or '/'
    for pg in pages:
        rx = '^' + re.sub(r'\[[^\]]+\]', '[^/]+', pg) + '$'
        if re.match(rx, p): return True
    return False

def hrefs(path):
    s = open(path).read()
    out = set(re.findall(r'''href:\s*['"]([^'"]+)['"]''', s))
    out |= set(re.findall(r'''href=['"](/[^'"]*)['"]''', s))
    out |= set(re.findall(r'''(?:router\.push|router\.replace|location\.href\s*=)\(?\s*['"](/[^'"]*)['"]''', s))
    return out

print("== LINKS DE NAVEGACION SIN PAGINA")
checks = {'admin layout': f'{APP}/dashboard/layout.tsx', 'conserje layout': f'{APP}/conserje/layout.tsx', 'portal dashboard': f'{APP}/portal/dashboard/page.tsx',
          'portal layout': f'{APP}/portal/page.tsx', 'superadmin layout': f'{APP}/superadmin/(admin)/layout.tsx', 'ventas layout': f'{APP}/ventas/layout.tsx', 'dashboard home': f'{APP}/dashboard/page.tsx'}
for name, path in checks.items():
    if not os.path.exists(path): print(f"  (no existe {path})"); continue
    bad = [h for h in hrefs(path) if h.startswith('/') and not h.startswith('/api') and not h.startswith('/uploads') and not page_exists(h)]
    print(f"  {name}: {len(hrefs(path))} links, sin pagina: {sorted(bad) or 'ninguno'}")

print("\n== TODOS LOS LINKS INTERNOS (Link href= / router.push) EN app/ SIN PAGINA")
allbad = {}
for f in glob.glob(f'{APP}/**/*.tsx', recursive=True):
    s = open(f).read()
    for h in set(re.findall(r'''href=\{?['"`](/[^'"`$?#]*)''', s)) | set(re.findall(r'''(?:router\.push|router\.replace)\(\s*['"`](/[^'"`$?#]*)''', s)):
        if h.startswith('/api') or h.startswith('/uploads') or h.startswith('/_next'): continue
        if h.endswith('/') or os.path.exists('public' + h): continue  # prefijo de link dinamico o archivo estatico
        if not page_exists(h): allbad.setdefault(h, set()).add(f[len(APP)+1:])
for h, fs in sorted(allbad.items()): print(f"  {h}  <- {', '.join(sorted(fs))[:120]}")

print("\n== FETCH /api/... SIN RUTA EN NINGUN BACKEND")
# rewrites: que prefijos van a condominios (8003); el resto va a core (8006)
cfg = open('next.config.js').read()
to_condo = [m for m in re.findall(r"source:\s*['\"](/api/[^'\"]+)['\"],\s*destination:\s*['\"]http://backend-condominios:8003", cfg)]
to_condo = [re.sub(r'/:path\*$', '', p) for p in to_condo]
def goes_condo(path):
    return any(path == p or path.startswith(p + '/') for p in to_condo)
def load_paths(url):
    try:
        d = json.load(urllib.request.urlopen(url, timeout=5)); return {p: set(k.upper() for k in v.keys()) for p, v in d['paths'].items()}
    except Exception as ex:
        return None
condo = load_paths('http://127.0.0.1:8003/openapi.json')
core = load_paths('http://127.0.0.1:8006/openapi.json')
if condo is None:
    # openapi deshabilitado: obtener rutas desde el contenedor
    out = subprocess.run(['docker', 'exec', 'conectaai_backend_condominios', 'python3', '-c', "from app.main import app; import json; print(json.dumps([[r.path, sorted(r.methods)] for r in app.routes if hasattr(r,'methods') and r.methods]))"], capture_output=True, text=True).stdout
    condo = {}
    for p, m in json.loads(out.strip().splitlines()[-1]): condo.setdefault(p, set()).update(m)
if core is None:
    out = subprocess.run(['docker', 'exec', 'conectaai_backend_core', 'sh', '-c', "python3 -c \"from app.main import app; import json; print(json.dumps([[r.path, sorted(r.methods)] for r in app.routes if hasattr(r,'methods') and r.methods]))\" 2>/dev/null || python3 -c \"from main import app; import json; print(json.dumps([[r.path, sorted(r.methods)] for r in app.routes if hasattr(r,'methods') and r.methods]))\""], capture_output=True, text=True).stdout
    core = {}
    try:
        for p, m in json.loads(out.strip().splitlines()[-1]): core.setdefault(p, set()).update(m)
    except Exception: pass
print(f"  rutas condominios: {len(condo)} · rutas core: {len(core)} · prefijos a condominios: {len(to_condo)}")
def rx(p): return re.compile('^' + re.sub(r'\{[^}]+\}', '[^/]+', p.rstrip('/') or '/') + '/?$')
condo_c = [(rx(p), m) for p, m in condo.items()]; core_c = [(rx(p), m) for p, m in core.items()]
next_routes = [rx(re.sub(r'\[[^\]]+\]', '{x}', f[len(APP):-len('/route.ts')])) for f in glob.glob(f'{APP}/api/**/route.ts', recursive=True)]
call_rx = re.compile(r'''(?:fetch|authFetch|apiFetch|vfetch|vjson)\(\s*(?:`|'|")(/api/[^'"`?]+)''')
method_rx = re.compile(r'''method:\s*['"](GET|POST|PUT|PATCH|DELETE)['"]''')
problems = {}; total = 0
for f in glob.glob(f'{APP}/**/*.ts*', recursive=True):
    src = open(f).read()
    for m in call_rx.finditer(src):
        raw = m.group(1); path = re.sub(r'\$\{[^}]+\}', '1', raw)
        path = re.sub(r"'\s*\+\s*[^+]+?\s*\+\s*'", '1', path)
        # literal termina en "/" => el id se concatena fuera del literal
        if path.endswith('/') and len(path) > 6: path = path + '1'
        path = path.rstrip('/')
        seg = src[m.end(): m.end() + 300]; mm = method_rx.search(seg); method = mm.group(1) if mm else 'GET'
        total += 1
        if any(r.match(path) for r in next_routes): continue
        table = condo_c if goes_condo(path) else core_c
        ok = any(r.match(path) and (method in ms) for r, ms in table)
        if not ok:
            other = any(r.match(path) and method in ms for r, ms in (core_c if table is condo_c else condo_c))
            problems.setdefault(f[len(APP)+1:], []).append(f"{method} {raw}" + ("  (existe en el OTRO backend: falta rewrite)" if other else "") + ("  [core]" if table is core_c else ""))
print(f"  llamadas: {total}; archivos con problemas: {len(problems)}")
for f, calls in sorted(problems.items()):
    print(f"  {f}"); [print("     ", c) for c in sorted(set(calls))]
