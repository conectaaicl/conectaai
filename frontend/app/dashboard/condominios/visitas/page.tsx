"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/hooks/useSession";

interface Visita {
  id: number;
  nombre_visitante: string;
  rut?: string;
  depto_destino: string;
  nombre_residente?: string;
  motivo: string;
  patente?: string;
  spot_estacionamiento?: string;
  hora_entrada: string;
  hora_salida?: string;
  registrado_por?: string;
}

interface Stats {
  visitas_hoy: number;
  en_edificio: number;
  esta_semana: number;
}

const MOTIVOS = [
  { value: "visita", label: "Visita", color: "bg-blue-100 text-blue-700" },
  { value: "delivery", label: "Delivery", color: "bg-yellow-100 text-yellow-700" },
  { value: "proveedor", label: "Proveedor", color: "bg-purple-100 text-purple-700" },
  { value: "tecnico", label: "Técnico", color: "bg-orange-100 text-orange-700" },
  { value: "otro", label: "Otro", color: "bg-slate-100 text-slate-600" },
];

const DATE_RANGES = [
  { value: "hoy", label: "Hoy" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mes" },
  { value: "todos", label: "Todos" },
];

function motivoStyle(motivo: string) {
  return MOTIVOS.find((m) => m.value === motivo)?.color ?? "bg-slate-100 text-slate-600";
}
function motivoLabel(motivo: string) {
  return MOTIVOS.find((m) => m.value === motivo)?.label ?? motivo;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}
function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

function calcTiempo(entrada: string, salida?: string): string {
  const start = new Date(entrada).getTime();
  const end = salida ? new Date(salida).getTime() : Date.now();
  const mins = Math.floor((end - start) / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export default function VisitasPage() {
  const { tenantId, loading } = useSession();
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [stats, setStats] = useState<Stats>({ visitas_hoy: 0, en_edificio: 0, esta_semana: 0 });
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterDepto, setFilterDepto] = useState("");
  const [filterMotivo, setFilterMotivo] = useState("todos");
  const [soloActivas, setSoloActivas] = useState(false);
  const [dateRange, setDateRange] = useState("hoy");

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    nombre_visitante: "",
    rut: "",
    depto_destino: "",
    nombre_residente: "",
    motivo: "visita",
    patente: "",
    spot_estacionamiento: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchVisitas = useCallback(async () => {
    if (!tenantId) return;
    setFetching(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tenant_id: String(tenantId) });
      if (search) params.append("q", search);
      if (filterDepto) params.append("depto", filterDepto);
      if (filterMotivo !== "todos") params.append("motivo", filterMotivo);
      if (soloActivas) params.append("activas", "1");
      if (dateRange !== "todos") params.append("rango", dateRange);
      const [visRes, statsRes] = await Promise.all([
        fetch(`/api/visitas?${params}`),
        fetch(`/api/visitas/stats?tenant_id=${tenantId}`),
      ]);
      if (!visRes.ok) throw new Error("Error al cargar visitas");
      const vd = await visRes.json();
      setVisitas(Array.isArray(vd) ? vd : (vd.visitas ?? []));
      if (statsRes.ok) {
        const s = await statsRes.json();
        setStats(s);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setFetching(false);
    }
  }, [tenantId, search, filterDepto, filterMotivo, soloActivas, dateRange]);

  useEffect(() => {
    if (!loading) fetchVisitas();
  }, [loading, fetchVisitas]);

  const handleSalida = async (id: number) => {
    try {
      const res = await fetch(`/api/visitas/${id}/salida`, { method: "PATCH" });
      if (!res.ok) throw new Error("Error");
      fetchVisitas();
    } catch {
      alert("No se pudo registrar la salida.");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre_visitante || !form.depto_destino) {
      setFormError("Nombre del visitante y departamento son obligatorios.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/visitas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tenant_id: tenantId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(d.message ?? "Error al registrar visita");
      }
      setShowCreate(false);
      setForm({ nombre_visitante: "", rut: "", depto_destino: "", nombre_residente: "", motivo: "visita", patente: "", spot_estacionamiento: "" });
      fetchVisitas();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registro de Visitas</h1>
          <p className="text-sm text-gray-500 mt-1">Historial completo de visitas del condominio</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Registrar Visita
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-blue-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.visitas_hoy}</p>
            <p className="text-xs text-gray-500">Visitas hoy</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-green-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.en_edificio}</p>
            <p className="text-xs text-gray-500">En edificio ahora</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-purple-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.esta_semana}</p>
            <p className="text-xs text-gray-500">Esta semana</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 space-y-3">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o RUT..."
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />
          <input
            type="text"
            value={filterDepto}
            onChange={(e) => setFilterDepto(e.target.value)}
            placeholder="Depto..."
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-28"
          />
          <select
            value={filterMotivo}
            onChange={(e) => setFilterMotivo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todos los motivos</option>
            {MOTIVOS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={soloActivas}
              onChange={(e) => setSoloActivas(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Solo activas
          </label>
        </div>
        {/* Date range chips */}
        <div className="flex gap-2">
          {DATE_RANGES.map((dr) => (
            <button
              key={dr.value}
              onClick={() => setDateRange(dr.value)}
              className={"px-3 py-1 text-xs font-medium rounded-full border transition-colors " + (dateRange === dr.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300")}
            >
              {dr.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
          {error}
          <button onClick={fetchVisitas} className="ml-3 underline font-medium">Reintentar</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {fetching ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : visitas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-600 mb-1">Sin visitas</h3>
            <p className="text-sm text-gray-400">No hay visitas que coincidan con los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Entrada</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Salida</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Visitante</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">RUT</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Depto</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Residente</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Motivo</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Patente</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Spot</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tiempo</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visitas.map((v) => (
                  <tr key={v.id} className={"hover:bg-gray-50/50 transition-colors " + (!v.hora_salida ? "bg-green-50/30" : "")}>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDateTime(v.hora_entrada)}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {v.hora_salida ? formatTime(v.hora_salida) : (
                        <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                          En edificio
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{v.nombre_visitante}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{v.rut ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{v.depto_destino}</td>
                    <td className="px-4 py-3 text-gray-600">{v.nombre_residente ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium " + motivoStyle(v.motivo)}>
                        {motivoLabel(v.motivo)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{v.patente ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{v.spot_estacionamiento ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs font-medium whitespace-nowrap">
                      {calcTiempo(v.hora_entrada, v.hora_salida)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        {!v.hora_salida && (
                          <button
                            onClick={() => handleSalida(v.id)}
                            className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
                          >
                            Registrar salida
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <Modal title="Registrar Visita" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre visitante <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.nombre_visitante}
                    onChange={(e) => setForm((f) => ({ ...f, nombre_visitante: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre completo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RUT</label>
                  <input
                    type="text"
                    value={form.rut}
                    onChange={(e) => setForm((f) => ({ ...f, rut: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="12.345.678-9"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Departamento destino <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.depto_destino}
                    onChange={(e) => setForm((f) => ({ ...f, depto_destino: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="402, 12B"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre residente</label>
                  <input
                    type="text"
                    value={form.nombre_residente}
                    onChange={(e) => setForm((f) => ({ ...f, nombre_residente: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Opcional"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
                <select
                  value={form.motivo}
                  onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {MOTIVOS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Patente vehículo</label>
                  <input
                    type="text"
                    value={form.patente}
                    onChange={(e) => setForm((f) => ({ ...f, patente: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ABCD12"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Spot estacionamiento</label>
                  <input
                    type="text"
                    value={form.spot_estacionamiento}
                    onChange={(e) => setForm((f) => ({ ...f, spot_estacionamiento: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="E-12"
                  />
                </div>
              </div>
            </div>
            {formError && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? "Registrando..." : "Registrar visita"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
