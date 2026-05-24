"""
Scanner — RFID card tap detection and device/port discovery
GET  /api/scanner/rfid/listen?tenant_id=X&timeout=30  → SSE: waits for next RFID tap and returns uid
POST /api/scanner/network/scan                         → scan subnet for open TCP devices
GET  /api/scanner/device/test?host=X&port=Y            → test single device TCP reachability
"""
import asyncio
import json
import os
import time
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/api/scanner", tags=["Scanner"])

# Per-tenant scan queues: {tenant_id: [Queue, ...]}
# Used by sistema.py to forward RFID events to active scan sessions
_scan_queues: dict = {}

DEVICE_TYPES = {
    4370: "ZKTeco/RFID Reader",
    80:   "HTTP Device",
    8080: "HTTP Alt",
    23:   "Telnet/Door Controller",
    26:   "Telnet Alt",
    8000: "API Device",
}


# ── Endpoint 1: SSE — wait for next RFID tap ────────────────────────────────

@router.get("/rfid/listen")
async def rfid_listen(tenant_id: int, timeout: int = 30):
    """
    SSE stream that waits for the next RFID card tap for a given tenant.
    Closes after first tap or after `timeout` seconds.
    """
    q: asyncio.Queue = asyncio.Queue(maxsize=10)
    _scan_queues.setdefault(tenant_id, []).append(q)

    async def generator():
        # Announce we are ready
        yield "data: " + json.dumps({"status": "waiting", "message": "Esperando tarjeta..."}) + "\n\n"
        try:
            data_str = await asyncio.wait_for(q.get(), timeout=float(timeout))
            event = json.loads(data_str)
            tipo = event.get("tipo", "")
            resultado = event.get("resultado", "desconocido")
            uid = event.get("card_uid") or ""
            yield "data: " + json.dumps({
                "status": "detected",
                "uid": uid,
                "tipo": tipo,
                "resultado": resultado,
                "persona_nombre": event.get("persona_nombre"),
            }) + "\n\n"
        except asyncio.TimeoutError:
            yield "data: " + json.dumps({
                "status": "timeout",
                "message": f"Sin lectura en {timeout} segundos",
            }) + "\n\n"
        finally:
            try:
                _scan_queues.get(tenant_id, []).remove(q)
            except ValueError:
                pass

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── Endpoint 2: Network scan ─────────────────────────────────────────────────

class ScanRequest(BaseModel):
    subnet: str = "192.168.1"
    ports: List[int] = [80, 8080, 4370, 23, 26, 8000]
    timeout_ms: int = 500


async def _check_port(ip: str, port: int, timeout_s: float) -> Optional[dict]:
    t0 = time.monotonic()
    try:
        _, writer = await asyncio.wait_for(
            asyncio.open_connection(ip, port),
            timeout=timeout_s,
        )
        latency = round((time.monotonic() - t0) * 1000, 1)
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        return {
            "ip": ip,
            "port": port,
            "open": True,
            "latency_ms": latency,
            "device_type": DEVICE_TYPES.get(port, "Unknown"),
        }
    except Exception:
        return None


@router.post("/network/scan")
async def network_scan(body: ScanRequest):
    """
    Scan an entire /24 subnet for open TCP ports concurrently.
    Returns only hosts with at least one open port.
    """
    timeout_s = body.timeout_ms / 1000.0

    tasks = [
        _check_port(f"{body.subnet}.{i}", port, timeout_s)
        for i in range(1, 255)
        for port in body.ports
    ]

    results = await asyncio.gather(*tasks, return_exceptions=False)

    # Group by IP: only include IPs with ≥1 open port
    open_results = [r for r in results if r is not None]
    return open_results


# ── Endpoint 3: Single device test ──────────────────────────────────────────

@router.get("/device/test")
async def device_test(host: str, port: int, timeout_ms: int = 2000):
    """Test TCP reachability to a single host:port."""
    timeout_s = timeout_ms / 1000.0
    t0 = time.monotonic()
    try:
        _, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port),
            timeout=timeout_s,
        )
        latency = round((time.monotonic() - t0) * 1000, 1)
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        return {"reachable": True, "latency_ms": latency, "host": host, "port": port}
    except Exception:
        latency = round((time.monotonic() - t0) * 1000, 1)
        return {"reachable": False, "latency_ms": latency, "host": host, "port": port}
