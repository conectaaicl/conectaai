#!/usr/bin/env python3
"""
ConectaAI RFID Bridge v2.1 — Multi-reader
Soporta: ACR122U, PN532, NXP MFRC522, lectores HID/genéricos 13.56MHz y 125KHz

Instalar:
    pip install pyscard

Ejecutar:
    python3 rfid_bridge.py

La interfaz web en condo.conectaai.cl/rfid se conecta automáticamente a http://localhost:8765
"""
import sys, time, threading, json, platform
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# ─── NFC/PC-SC (ACR122U, PN532, y compatibles CCID) ─────────────────────────
try:
    from smartcard.System import readers as pcsc_readers
    from smartcard.util import toHexString, toBytes
    PCSC_OK = True
except ImportError:
    PCSC_OK = False

SW_OK = [0x90, 0x00]

# APDUs estándar ISO 14443 / MIFARE
CMD_GET_UID  = [0xFF, 0xCA, 0x00, 0x00, 0x00]
CMD_LOAD_KEY = [0xFF, 0x82, 0x20, 0x00, 0x06]
CMD_AUTH_A   = [0xFF, 0x86, 0x00, 0x00, 0x05, 0x01, 0x00, 0x00, 0x60, 0x00]
CMD_WRITE    = [0xFF, 0xD6, 0x00]
DEFAULT_KEY  = "FFFFFFFFFFFF"

_lock = threading.Lock()

READER_PROFILES = {
    "ACR122":  {"name": "ACS ACR122U",   "proto": "pcsc", "freqs": ["13.56MHz"], "write": True},
    "ACR1251": {"name": "ACS ACR1251",   "proto": "pcsc", "freqs": ["13.56MHz"], "write": True},
    "PN532":   {"name": "NXP PN532",     "proto": "pcsc", "freqs": ["13.56MHz", "125KHz"], "write": True},
    "SCL3711": {"name": "SCM SCL3711",   "proto": "pcsc", "freqs": ["13.56MHz"], "write": True},
    "CL RC52": {"name": "MFRC522 Clone", "proto": "pcsc", "freqs": ["13.56MHz"], "write": True},
    "OMNIKEY": {"name": "HID OMNIKEY",   "proto": "pcsc", "freqs": ["13.56MHz", "125KHz"], "write": True},
    "DEFAULT": {"name": "Lector NFC/RFID genérico", "proto": "pcsc", "freqs": ["13.56MHz"], "write": True},
}


def detect_reader():
    """Detecta el primer lector disponible y devuelve su perfil."""
    if not PCSC_OK:
        return None, None
    try:
        rs = pcsc_readers()
        if not rs:
            return None, None
        r = rs[0]
        rname = str(r)
        for key, profile in READER_PROFILES.items():
            if key.lower() in rname.lower():
                return r, {**profile, "raw_name": rname}
        return r, {**READER_PROFILES["DEFAULT"], "raw_name": rname}
    except Exception:
        return None, None


def get_conn(reader=None):
    if reader is None:
        rs = pcsc_readers()
        if not rs:
            raise Exception("Sin lector RFID conectado")
        reader = rs[0]
    conn = reader.createConnection()
    conn.connect()
    return conn


def send(conn, cmd):
    data, sw1, sw2 = conn.transmit(cmd)
    return data, [sw1, sw2]


def read_uid(timeout=25):
    """Espera tarjeta y devuelve su UID (funciona con cualquier lector PC/SC)."""
    if not PCSC_OK:
        return {"ok": False, "error": "pyscard no instalado — ejecuta: pip install pyscard"}

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with _lock:
                conn = get_conn()
                data, sw = send(conn, CMD_GET_UID)
                if sw == SW_OK and data:
                    uid = "".join(f"{b:02X}" for b in data)
                    conn.disconnect()
                    return {"ok": True, "uid": uid, "bytes": len(data)}
                conn.disconnect()
        except Exception as e:
            msg = str(e)
            if any(x in msg for x in ["No card", "No smart card", "Card removed", "removed", "not found"]):
                time.sleep(0.25)
                continue
            if any(x in msg for x in ["No reader", "readers"]):
                return {"ok": False, "error": "Lector desconectado"}
            time.sleep(0.25)
    return {"ok": False, "error": f"Sin tarjeta en {timeout}s — acerca la tarjeta al lector"}


def write_keys(sector_keys: list, timeout=25):
    """Escribe llaves de sector en tarjeta MIFARE Classic 1K."""
    if not PCSC_OK:
        return {"ok": False, "error": "pyscard no instalado"}

    uid_r = read_uid(timeout=timeout)
    if not uid_r.get("ok"):
        return uid_r

    uid = uid_r["uid"]
    ok_sectors, fail_sectors = [], []

    try:
        with _lock:
            conn = get_conn()
            for sk in sector_keys:
                sector = sk["sector"]
                key_a  = sk["key_a"].upper().replace(" ", "")
                key_b  = sk["key_b"].upper().replace(" ", "")
                trailer = sector * 4 + 3
                wrote = False

                for try_key in [DEFAULT_KEY, key_a]:
                    try:
                        kbytes = toBytes(try_key)
                        _, sw = send(conn, CMD_LOAD_KEY + kbytes)
                        if sw != SW_OK: continue
                        auth = list(CMD_AUTH_A); auth[7] = trailer
                        _, sw = send(conn, auth)
                        if sw != SW_OK: continue
                        ka = toBytes(key_a); kb = toBytes(key_b)
                        access = [0xFF, 0x07, 0x80, 0x00]
                        trailer_data = ka + access + kb
                        _, sw = send(conn, CMD_WRITE + [trailer, 0x10] + trailer_data)
                        if sw == SW_OK:
                            ok_sectors.append(sector); wrote = True; break
                    except Exception:
                        continue

                if not wrote:
                    fail_sectors.append(sector)

            conn.disconnect()
    except Exception as e:
        return {"ok": False, "error": str(e), "uid": uid}

    return {
        "ok": len(fail_sectors) == 0,
        "uid": uid,
        "sectors_ok": len(ok_sectors),
        "sectors_failed": fail_sectors,
        "message": f"{len(ok_sectors)}/{len(sector_keys)} sectores grabados en {uid}"
    }


# ─── HTTP Bridge ─────────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200); self.cors(); self.end_headers()

    def json(self, data, code=200):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", len(body))
        self.cors(); self.end_headers(); self.wfile.write(body)

    def do_GET(self):
        p = urlparse(self.path)
        qs = parse_qs(p.query)

        if p.path == "/status":
            reader, profile = detect_reader()
            self.json({
                "ok": True,
                "pcsc": PCSC_OK,
                "reader": profile["raw_name"] if profile else None,
                "reader_name": profile["name"] if profile else None,
                "freqs": profile["freqs"] if profile else [],
                "can_write": profile.get("write", False) if profile else False,
                "platform": platform.system(),
                "version": "2.1"
            })

        elif p.path == "/read-uid":
            timeout = int(qs.get("timeout", [25])[0])
            print(f"  📡 Leyendo UID (timeout={timeout}s)…")
            r = read_uid(timeout=timeout)
            print(f"  {'✅' if r['ok'] else '❌'} {r}")
            self.json(r)

        elif p.path == "/readers":
            rs = []
            if PCSC_OK:
                try:
                    rs = [str(r) for r in pcsc_readers()]
                except Exception:
                    pass
            self.json({"readers": rs, "count": len(rs)})

        else:
            self.json({"error": "Not found"}, 404)

    def do_POST(self):
        p = urlparse(self.path)
        n = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(n) if n else b"{}"
        try:
            data = json.loads(body)
        except Exception:
            self.json({"error": "JSON inválido"}, 400); return

        if p.path == "/write-keys":
            sectors = data.get("sectors", [])
            timeout = data.get("timeout", 25)
            if not sectors:
                self.json({"error": "sectors requeridos"}, 400); return
            print(f"  ✏️  Grabando {len(sectors)} sectores…")
            r = write_keys(sectors, timeout=timeout)
            print(f"  {'✅' if r['ok'] else '❌'} {r}")
            self.json(r)
        else:
            self.json({"error": "Not found"}, 404)


def main():
    PORT = 8765
    print("=" * 60)
    print("  ConectaAI RFID Bridge v2.1 — Multi-lector")
    print("=" * 60)
    print()

    if not PCSC_OK:
        print("❌ Falta instalar pyscard:")
        print("   pip install pyscard")
        print()
        if platform.system() == "Windows":
            print("   En Windows también necesitas el servicio 'Smart Card'")
            print("   (Services → Smart Card → Start)")
        sys.exit(1)

    reader, profile = detect_reader()
    if profile:
        print(f"✅ Lector detectado: {profile['raw_name']}")
        print(f"   Modelo: {profile['name']}")
        print(f"   Frecuencias: {', '.join(profile['freqs'])}")
        print(f"   Escritura: {'Sí' if profile.get('write') else 'Solo lectura'}")
    else:
        print("⚠️  Sin lector detectado — conéctalo y el bridge lo reconocerá automáticamente")
        print()
        print("   Lectores compatibles:")
        print("   • ACR122U / ACR1251U (ACS)")
        print("   • PN532 USB (NXP / genérico AliExpress)")
        print("   • OMNIKEY (HID)")
        print("   • SCL3711 (SCM)")
        print("   • Cualquier lector NFC USB con driver PC/SC")

    print()
    print(f"🚀 Bridge activo en http://localhost:{PORT}")
    print(f"   Abre: https://rfid.conectaai.cl")
    print(f"   O:    https://condo.conectaai.cl/dashboard/condominios/rfid/enroll")
    print()
    print("   Ctrl+C para detener")
    print()

    server = HTTPServer(("127.0.0.1", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n✋ Bridge detenido.")


if __name__ == "__main__":
    main()
