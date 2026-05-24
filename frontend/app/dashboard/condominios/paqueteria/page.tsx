"use client";

import { useState, useEffect, useCallback } from "react";
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
  { value: "otro", label: "Otro", color: "bg-slate-100 text-slate-700 border-slate-200" },
];

function carrierStyle(carrier: string) {
  return CARRIERS.find((c) => c.value === carrier)?.color ?? "bg-slate-100 text-slate-700 border-slate-200";
}
function carrierLabel(carrier: string) {
  return CARRIERS.find((c) => c.value === carrier)?.label ?? carrier;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
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

export default function PaqueteriaPage() {
  const { tenantId, loading } = useSession();
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [stats, setStats] = useState<Stats>({ pendientes: 0, entregados_hoy: 0, total_mes: 0 });
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterCarrier, setFilterCarrier] = useState("todos");
  const [filterDepto, setFilterDepto] = useState("");
  const [filterEstado, setFilterEstado] = useState("todos");

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ carrier: "chilexpress", depto_destino: "", nombre_destinatario: "", tracking_number: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchPaquetes = useCallback(async () => {
    if (!tenantId) return;
    setFetching(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tenant_id: String(tenantId) });
      if (filterCarrier !== "todos") params.append("carrier", filterCarrier);
      if (filterDepto) params.append("depto", filterDepto);
      if (filterEstado !== "todos") params.append("estado", filterEstado);
      const [pkgRes, statsRes] = await Promise.all([
        fetch(`/api/paqueteria?${params}`),
        fetch(`/api/paqueteria/stats?tenant_id=${tenantId}`),
      ]);
      if (!pkgRes.ok) throw new Error("Error al cargar paquetes");
      const pkgData = await pkgRes.json();
      setPaquetes(Array.isArray(pkgData) ? pkgData : (pkgData.paquetes ?? []));
      if (statsRes.ok) {
        const s = await statsRes.json();
        setStats(s);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setFetching(false);
    }
  }, [tenantId, filterCarrier, filterDepto, filterEstado]);

  useEffect(() => {
    if (!loading) fetchPaquetes();
  }, [loading, fetchPaquetes]);

  const handleEntregar = async (id: number) => {
    try {
      const res = await fetch(`/api/paqueteria/${id}/entregar`, { method: "PATCH" });
      if (!res.ok) throw new Error("Error");
      fetchPaquetes();
    } catch {
      alert("No se pudo marcar como entregado.");
    }
  };

  const handleEliminar = async (id: number) => {
    if (!confirm("¿Eliminar este paquete del registro?")) return;
    try {
      const res = await fetch(`/api/paqueteria/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error");
      fetchPaquetes();
    } catch {
      alert("No se pudo eliminar el paquete.");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.depto_destino || !form.nombre_destinatario) {
      setFormError("Departamento y destinatario son obligatorios.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/paqueteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tenant_id: tenantId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(d.message ?? "Error al registrar paquete");
      }
      setShowCreate(false);
      setForm({ carrier: "chilexpress", depto_destino: "", nombre_destinatario: "", tracking_number: "" });
      fetchPaquetes();
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
          <h1 className="text-2xl font-bold text-gray-900">Paquetería</h1>
          <p className="text-sm text-gray-500 mt-1">Registro y control de encomiendas del condominio</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Registrar Paquete
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-orange-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.pendientes}</p>
            <p className="text-xs text-gray-500">Pendientes</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-green-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.entregados_hoy}</p>
            <p className="text-xs text-gray-500">Entregados hoy</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-blue-100 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.total_mes}</p>
            <p className="text-xs text-gray-500">Total mes</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 space-y-3">
        {/* Carrier chips */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterCarrier("todos")}
            className={"px-3 py-1 text-xs font-medium rounded-full border transition-colors " + (filterCarrier === "todos" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300")}
          >
            Todos
          </button>
          {CARRIERS.map((c) => (
            <button
              key={c.value}
              onClick={() => setFilterCarrier(filterCarrier === c.value ? "todos" : c.value)}
              className={"px-3 py-1 text-xs font-medium rounded-full border transition-colors " + (filterCarrier === c.value ? "ring-2 ring-offset-1 ring-blue-400 " + c.color : "bg-white text-gray-600 border-gray-200 hover:border-gray-300")}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            value={filterDepto}
            onChange={(e) => setFilterDepto(e.target.value)}
            placeholder="Buscar depto..."
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
          />
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="entregado">Entregados</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
          {error}
          <button onClick={fetchPaquetes} className="ml-3 underline font-medium">Reintentar</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {fetching ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : paquetes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-600 mb-1">Sin paquetes</h3>
            <p className="text-sm text-gray-400">No hay paquetes que coincidan con los filtros seleccionados.</p>
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
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Registrado por</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paquetes.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDateTime(p.fecha_recepcion)}</td>
                    <td className="px-4 py-3">
                      <span className={"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border " + carrierStyle(p.carrier)}>
                        {carrierLabel(p.carrier)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{p.depto_destino}</td>
                    <td className="px-4 py-3 text-gray-700">{p.nombre_destinatario}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.tracking_number ?? "—"}</td>
                    <td className="px-4 py-3">
                      {p.estado === "pendiente" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
                          Pendiente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                          Entregado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.registrado_por ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {p.estado === "pendiente" && (
                          <button
                            onClick={() => handleEntregar(p.id)}
                            className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                          >
                            Entregar
                          </button>
                        )}
                        <button
                          onClick={() => handleEliminar(p.id)}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          Eliminar
                        </button>
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
        <Modal title="Registrar Paquete" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Carrier</label>
                <select
                  value={form.carrier}
                  onChange={(e) => setForm((f) => ({ ...f, carrier: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CARRIERS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
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
                  placeholder="Ej: 402, 12B"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre destinatario <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.nombre_destinatario}
                  onChange={(e) => setForm((f) => ({ ...f, nombre_destinatario: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nombre del residente"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número de tracking</label>
                <input
                  type="text"
                  value={form.tracking_number}
                  onChange={(e) => setForm((f) => ({ ...f, tracking_number: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Opcional"
                />
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
                {submitting ? "Registrando..." : "Registrar paquete"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
