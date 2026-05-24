"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "@/hooks/useSession";

interface Paquete {
  id: number;
  carrier: string;
  depto_destino: string;
  nombre_destinatario: string;
  email_destinatario?: string;
  tracking_number?: string;
  estado: "pendiente" | "entregado";
  registrado_por?: string;
  fecha_recepcion: string;
  fecha_entrega?: string;
}

interface Stats {
  pendientes: number;
  entregados_hoy: number;
  total_mes: number;
}

const CARRIERS = [
  { value: "chilexpress", label: "Chilexpress", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "bluexpress", label: "Bluexpress", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "mercadolibre", label: "Mercado Libre", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { value: "correos_chile", label: "Correos Chile", color: "bg-green-100 text-green-700 border-green-200" },
  { value: "starken", label: "Starken", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "dhl", label: "DHL", color: "bg-red-100 text-red-800 border-red-300" },
  { value: "fedex", label: "FedEx", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "shein", label: "Shein", color: "bg-pink-100 text-pink-700 border-pink-200" },
  { value: "amazon", label: "Amazon", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "temu", label: "Temu", color: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "aliexpress", label: "AliExpress", color: "bg-rose-100 text-rose-700 border-rose-200" },
  { value: "otro", label: "Otro", color: "bg-slate-100 text-slate-700 border-slate-200" },
];

function detectCarrier(tracking: string): string {
  const t = tracking.trim().toUpperCase();
  if (/^(RC|RR|CP|EE|EM|LM|LA|LC)\d{9}CL$/.test(t)) return "correos_chile";
  if (/^CHX\d+/i.test(t) || (/^\d{12,15}$/.test(t) && t.startsWith("9"))) return "chilexpress";
  if (/^BLX/i.test(t) || /^B[A-Z]\d{10,}/.test(t)) return "bluexpress";
  if (/^TBA\d{12,}/.test(t) || /^1Z/.test(t)) return "amazon";
  if (/^JD\d{20}/.test(t) || /^MLE\d+/i.test(t)) return "mercadolibre";
  if (/^\d{10,12}$/.test(t)) return "starken";
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(t)) return "correos_chile";
  if (/^DHL/i.test(t)) return "dhl";
  if (/^SHEIN/i.test(t) || /^SE\d+/i.test(t)) return "shein";
  if (/^TEMU/i.test(t)) return "temu";
  return "otro";
}

function carrierStyle(carrier: string) {
  return CARRIERS.find((c) => c.value === carrier)?.color ?? "bg-slate-100 text-slate-700 border-slate-200";
}
function carrierLabel(carrier: string) {
  return CARRIERS.find((c) => c.value === carrier)?.label ?? carrier;
}
function fmt(iso: string) {
  return new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

export default function PaqueteriaPage() {
  const { tenantId, loading } = useSession();
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [stats, setStats] = useState<Stats>({ pendientes: 0, entregados_hoy: 0, total_mes: 0 });
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterCarrier, setFilterCarrier] = useState("todos");
  const [filterDepto, setFilterDepto] = useState("");
  const [filterEstado, setFilterEstado] = useState("todos");

  // Scan mode
  const [scanning, setScanning] = useState(false);
  const [scanForm, setScanForm] = useState({ carrier: "otro", tracking_number: "", depto_destino: "", nombre_destinatario: "" });
  const [scanFeedback, setScanFeedback] = useState<"ok" | "err" | null>(null);
  const [scanSaving, setScanSaving] = useState(false);
  const trackingRef = useRef<HTMLInputElement>(null);

  // Manual modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ carrier: "chilexpress", depto_destino: "", nombre_destinatario: "", tracking_number: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setFetching(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tenant_id: String(tenantId) });
      if (filterCarrier !== "todos") params.append("carrier", filterCarrier);
      if (filterDepto) params.append("depto", filterDepto);
      if (filterEstado !== "todos") params.append("estado", filterEstado);
      const [pkgRes, statsRes] = await Promise.all([
        fetch("/api/paqueteria?" + params),
        fetch("/api/paqueteria/stats?tenant_id=" + tenantId),
      ]);
      if (!pkgRes.ok) throw new Error("Error al cargar paquetes");
      const d = await pkgRes.json();
      setPaquetes(Array.isArray(d) ? d : (d.paquetes ?? []));
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally { setFetching(false); }
  }, [tenantId, filterCarrier, filterDepto, filterEstado]);

  useEffect(() => { if (!loading) fetchData(); }, [loading, fetchData]);

  useEffect(() => {
    if (scanning) setTimeout(() => trackingRef.current?.focus(), 100);
  }, [scanning]);

  function handleTrackingChange(val: string) {
    setScanForm(f => ({ ...f, tracking_number: val, carrier: detectCarrier(val) }));
  }

  function handleTrackingKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && scanForm.tracking_number.trim().length > 3) {
      e.preventDefault();
      (document.getElementById("scan-depto") as HTMLInputElement)?.focus();
    }
  }

  async function handleScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scanForm.depto_destino.trim()) return;
    setScanSaving(true);
    try {
      const r = await fetch("/api/paqueteria", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          carrier: scanForm.carrier,
          tracking_number: scanForm.tracking_number || null,
          depto_destino: scanForm.depto_destino.trim(),
          nombre_destinatario: scanForm.nombre_destinatario || null,
        }),
      });
      if (r.ok) {
        setScanFeedback("ok");
        fetchData();
        setTimeout(() => {
          setScanForm({ carrier: "otro", tracking_number: "", depto_destino: "", nombre_destinatario: "" });
          setScanFeedback(null);
          trackingRef.current?.focus();
        }, 1500);
      } else {
        setScanFeedback("err");
        setTimeout(() => setScanFeedback(null), 2000);
      }
    } finally { setScanSaving(false); }
  }

  const handleEntregar = async (id: number) => {
    try {
      const res = await fetch("/api/paqueteria/" + id + "/entregar", { method: "PATCH" });
      if (!res.ok) throw new Error();
      fetchData();
    } catch { alert("No se pudo marcar como entregado."); }
  };

  const handleEliminar = async (id: number) => {
    if (!confirm("Eliminar este paquete del registro?")) return;
    try {
      const res = await fetch("/api/paqueteria/" + id, { method: "DELETE" });
      if (!res.ok) throw new Error();
      fetchData();
    } catch { alert("No se pudo eliminar."); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.depto_destino || !form.nombre_destinatario) { setFormError("Departamento y destinatario son obligatorios."); return; }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/paqueteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tenant_id: tenantId }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})) as { message?: string }; throw new Error(d.message ?? "Error"); }
      setShowCreate(false);
      setForm({ carrier: "chilexpress", depto_destino: "", nombre_destinatario: "", tracking_number: "" });
      fetchData();
    } catch (e: unknown) { setFormError(e instanceof Error ? e.message : "Error"); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paqueteria</h1>
          <p className="text-sm text-gray-500 mt-1">Registro y control de encomiendas del condominio</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setScanning(s => !s); setShowCreate(false); setScanFeedback(null); }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition shadow-sm ${scanning ? "bg-indigo-700 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8H4a1 1 0 00-1 1v10a1 1 0 001 1h3M9 4H5a1 1 0 00-1 1v3" />
            </svg>
            {scanning ? "Cerrar Scanner" : "Escanear codigo"}
          </button>
          <button
            onClick={() => { setShowCreate(true); setScanning(false); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Registrar
          </button>
        </div>
      </div>

      {/* SCAN PANEL */}
      {scanning && (
        <div className="bg-indigo-50 border-2 border-indigo-300 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
            <h2 className="font-bold text-indigo-900 text-base">Modo Escaneo — Lector de codigos de barra activo</h2>
          </div>
          {scanFeedback === "ok" && (
            <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl p-3 mb-4 text-sm font-semibold text-center">
              Paquete registrado — notificacion enviada al residente
            </div>
          )}
          {scanFeedback === "err" && (
            <div className="bg-red-100 border border-red-300 text-red-700 rounded-xl p-3 mb-4 text-sm font-semibold text-center">
              Error al registrar
            </div>
          )}
          <form onSubmit={handleScanSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-indigo-700 mb-1">1. Escanea el codigo de barras del paquete</label>
              <input
                ref={trackingRef}
                value={scanForm.tracking_number}
                onChange={e => handleTrackingChange(e.target.value)}
                onKeyDown={handleTrackingKey}
                placeholder="Apunta el lector al paquete..."
                autoComplete="off"
                className="w-full px-3 py-2.5 border-2 border-indigo-300 rounded-xl text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {scanForm.tracking_number && (
                <p className="text-xs text-indigo-600 mt-1">Carrier detectado: <strong>{carrierLabel(scanForm.carrier)}</strong></p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-indigo-700 mb-1">2. Departamento destino *</label>
              <input
                id="scan-depto"
                required
                value={scanForm.depto_destino}
                onChange={e => setScanForm(f => ({ ...f, depto_destino: e.target.value }))}
                placeholder="Ej: 304, 12A"
                className="w-full px-3 py-2.5 border-2 border-indigo-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-col justify-end">
              <button
                type="submit"
                disabled={scanSaving || !scanForm.depto_destino.trim()}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition"
              >
                {scanSaving ? "Registrando..." : "3. Registrar y notificar"}
              </button>
            </div>
          </form>
          <p className="text-xs text-indigo-500 mt-3 text-center">
            Despues de registrar, el lector queda listo para el siguiente paquete automaticamente
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-orange-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </div>
          <div><p className="text-2xl font-bold text-gray-900">{stats.pendientes}</p><p className="text-xs text-gray-500">Pendientes</p></div>
        </div>
        <div className="bg-white rounded-xl border border-green-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <div><p className="text-2xl font-bold text-gray-900">{stats.entregados_hoy}</p><p className="text-xs text-gray-500">Entregados hoy</p></div>
        </div>
        <div className="bg-white rounded-xl border border-blue-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </div>
          <div><p className="text-2xl font-bold text-gray-900">{stats.total_mes}</p><p className="text-xs text-gray-500">Total mes</p></div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterCarrier("todos")} className={`px-3 py-1 text-xs font-medium rounded-full border transition ${filterCarrier === "todos" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}>Todos</button>
          {CARRIERS.map((c) => (
            <button key={c.value} onClick={() => setFilterCarrier(filterCarrier === c.value ? "todos" : c.value)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition ${filterCarrier === c.value ? "ring-2 ring-offset-1 ring-blue-400 " + c.color : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex gap-3 flex-wrap">
          <input type="text" value={filterDepto} onChange={(e) => setFilterDepto(e.target.value)} placeholder="Buscar depto..." className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40" />
          <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="todos">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="entregado">Entregados</option>
          </select>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">{error} <button onClick={fetchData} className="ml-3 underline font-medium">Reintentar</button></div>}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {fetching ? (
          <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : paquetes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            </div>
            <h3 className="text-base font-semibold text-gray-600 mb-1">Sin paquetes</h3>
            <p className="text-sm text-gray-400">No hay paquetes con los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Recibido</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Carrier</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Depto</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Destinatario</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tracking</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paquetes.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmt(p.fecha_recepcion)}</td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${carrierStyle(p.carrier)}`}>{carrierLabel(p.carrier)}</span></td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{p.depto_destino}</td>
                    <td className="px-4 py-3 text-gray-700">{p.nombre_destinatario}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.tracking_number ?? "—"}</td>
                    <td className="px-4 py-3">
                      {p.estado === "pendiente"
                        ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />Pendiente</span>
                        : <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />Entregado</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {p.estado === "pendiente" && <button onClick={() => handleEntregar(p.id)} className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition">Entregar</button>}
                        <button onClick={() => handleEliminar(p.id)} className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Registrar Paquete</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="px-6 py-5">
              <form onSubmit={handleCreate}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Carrier</label>
                    <select value={form.carrier} onChange={(e) => setForm((f) => ({ ...f, carrier: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {CARRIERS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Departamento destino <span className="text-red-500">*</span></label>
                    <input required value={form.depto_destino} onChange={(e) => setForm((f) => ({ ...f, depto_destino: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ej: 402, 12B" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre destinatario <span className="text-red-500">*</span></label>
                    <input required value={form.nombre_destinatario} onChange={(e) => setForm((f) => ({ ...f, nombre_destinatario: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nombre del residente" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Numero de tracking</label>
                    <input value={form.tracking_number} onChange={(e) => setForm((f) => ({ ...f, tracking_number: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Opcional" />
                  </div>
                </div>
                {formError && <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>}
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition">Cancelar</button>
                  <button type="submit" disabled={submitting} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">{submitting ? "Registrando..." : "Registrar paquete"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
