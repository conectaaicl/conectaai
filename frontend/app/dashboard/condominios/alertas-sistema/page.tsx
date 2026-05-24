"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "@/hooks/useSession";

interface Alerta {
  id: number;
  tipo: string;
  nivel: "critico" | "error" | "advertencia" | "info";
  titulo: string;
  descripcion?: string;
  servicio?: string;
  estado: "pendiente" | "acknowledged" | "resuelta";
  creado_en: string;
}

interface Resumen {
  critico: number;
  error: number;
  advertencia: number;
  info: number;
}

const NIVELES = [
  { value: "critico", label: "Crítico", color: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500", badge: "bg-red-100 text-red-700", statBg: "bg-red-50 border-red-100", statText: "text-red-600", statNum: "text-red-700" },
  { value: "error", label: "Error", color: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500", badge: "bg-orange-100 text-orange-700", statBg: "bg-orange-50 border-orange-100", statText: "text-orange-600", statNum: "text-orange-700" },
  { value: "advertencia", label: "Advertencia", color: "bg-yellow-100 text-yellow-700 border-yellow-200", dot: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-700", statBg: "bg-yellow-50 border-yellow-100", statText: "text-yellow-600", statNum: "text-yellow-700" },
  { value: "info", label: "Info", color: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-400", badge: "bg-blue-100 text-blue-700", statBg: "bg-blue-50 border-blue-100", statText: "text-blue-600", statNum: "text-blue-700" },
];

const TIPOS: Record<string, string> = {
  dispositivo_offline: "Dispositivo Offline",
  servicio_caido: "Servicio Caído",
  error_email: "Error Email",
  conexion_perdida: "Conexión Perdida",
  otro: "Otro",
};

const ESTADO_MAP: Record<string, { label: string; cls: string }> = {
  pendiente: { label: "Pendiente", cls: "bg-red-50 text-red-700 border-red-200" },
  acknowledged: { label: "Confirmada", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  resuelta: { label: "Resuelta", cls: "bg-green-50 text-green-700 border-green-200" },
};

function nivelInfo(nivel: string) {
  return NIVELES.find((n) => n.value === nivel) ?? NIVELES[3];
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

export default function AlertasSistemaPage() {
  const { tenantId, loading } = useSession();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [resumen, setResumen] = useState<Resumen>({ critico: 0, error: 0, advertencia: 0, info: 0 });
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Filters
  const [filterNivel, setFilterNivel] = useState("todos");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [soloActivas, setSoloActivas] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAlertas = useCallback(async () => {
    if (!tenantId) return;
    setError(null);
    try {
      const params = new URLSearchParams({ tenant_id: String(tenantId) });
      if (filterNivel !== "todos") params.append("nivel", filterNivel);
      if (filterTipo !== "todos") params.append("tipo", filterTipo);
      if (soloActivas) params.append("solo_activas", "1");
      const [alertRes, resRes] = await Promise.all([
        fetch(`/api/alertas-sistema?${params}`),
        fetch(`/api/alertas-sistema/resumen?tenant_id=${tenantId}`),
      ]);
      if (!alertRes.ok) throw new Error("Error al cargar alertas");
      const ad = await alertRes.json();
      setAlertas(Array.isArray(ad) ? ad : (ad.alertas ?? []));
      if (resRes.ok) {
        const r = await resRes.json();
        setResumen(r);
      }
      setLastRefresh(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setFetching(false);
    }
  }, [tenantId, filterNivel, filterTipo, soloActivas]);

  useEffect(() => {
    if (!loading) {
      fetchAlertas();
      intervalRef.current = setInterval(fetchAlertas, 30000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loading, fetchAlertas]);

  const handleAck = async (id: number) => {
    try {
      const res = await fetch(`/api/alertas-sistema/${id}/ack`, { method: "PATCH" });
      if (!res.ok) throw new Error("Error");
      fetchAlertas();
    } catch {
      alert("No se pudo confirmar la alerta.");
    }
  };

  const handleResolver = async (id: number) => {
    try {
      const res = await fetch(`/api/alertas-sistema/${id}/resolver`, { method: "PATCH" });
      if (!res.ok) throw new Error("Error");
      fetchAlertas();
    } catch {
      alert("No se pudo resolver la alerta.");
    }
  };

  const handleEliminar = async (id: number) => {
    if (!confirm("¿Eliminar esta alerta del registro?")) return;
    try {
      const res = await fetch(`/api/alertas-sistema/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error");
      fetchAlertas();
    } catch {
      alert("No se pudo eliminar la alerta.");
    }
  };

  const totalAlertas = resumen.critico + resumen.error + resumen.advertencia + resumen.info;

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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Alertas del Sistema</h1>
            {totalAlertas > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-600 text-white">
                {totalAlertas}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Auto-actualización cada 30 s — Última vez: {lastRefresh.toLocaleTimeString("es-CL", { timeStyle: "short" })}
          </p>
        </div>
        <button
          onClick={fetchAlertas}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Actualizar
        </button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {NIVELES.map((n) => (
          <div key={n.value} className={"rounded-xl border p-4 " + n.statBg}>
            <div className="flex items-center justify-between mb-1">
              <span className={"text-xs font-medium " + n.statText}>{n.label}</span>
              <span className={"w-2.5 h-2.5 rounded-full " + n.dot} />
            </div>
            <p className={"text-3xl font-bold " + n.statNum}>
              {resumen[n.value as keyof Resumen] ?? 0}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 space-y-3">
        {/* Nivel chips */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterNivel("todos")}
            className={"px-3 py-1 text-xs font-medium rounded-full border transition-colors " + (filterNivel === "todos" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300")}
          >
            Todos los niveles
          </button>
          {NIVELES.map((n) => (
            <button
              key={n.value}
              onClick={() => setFilterNivel(filterNivel === n.value ? "todos" : n.value)}
              className={"px-3 py-1 text-xs font-medium rounded-full border transition-colors " + (filterNivel === n.value ? "ring-2 ring-offset-1 ring-blue-400 " + n.badge : "bg-white text-gray-600 border-gray-200 hover:border-gray-300")}
            >
              {n.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todos los tipos</option>
            {Object.entries(TIPOS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={soloActivas}
              onChange={(e) => setSoloActivas(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Solo no resueltas
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
          {error}
          <button onClick={fetchAlertas} className="ml-3 underline font-medium">Reintentar</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {fetching ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : alertas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-green-700 mb-1">Sin alertas activas</h3>
            <p className="text-sm text-gray-400">Todos los sistemas operando normalmente.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nivel</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Título</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Descripción</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Servicio</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {alertas.map((a) => {
                  const nInfo = nivelInfo(a.nivel);
                  const eInfo = ESTADO_MAP[a.estado] ?? { label: a.estado, cls: "bg-gray-100 text-gray-600 border-gray-200" };
                  return (
                    <tr key={a.id} className={"hover:bg-gray-50/50 transition-colors " + (a.nivel === "critico" ? "bg-red-50/20" : "")}>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{formatDateTime(a.creado_en)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {TIPOS[a.tipo] ?? a.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={"inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border " + nInfo.color}>
                          <span className={"w-1.5 h-1.5 rounded-full inline-block " + nInfo.dot} />
                          {nInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-xs">
                        <span className="line-clamp-2">{a.titulo}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-xs">
                        <span className="line-clamp-2 text-xs">{a.descripcion ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono">{a.servicio ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border " + eInfo.cls}>
                          {eInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {a.estado === "pendiente" && (
                            <button
                              onClick={() => handleAck(a.id)}
                              className="px-2.5 py-1.5 text-xs font-medium text-yellow-700 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors whitespace-nowrap"
                            >
                              Confirmar
                            </button>
                          )}
                          {a.estado !== "resuelta" && (
                            <button
                              onClick={() => handleResolver(a.id)}
                              className="px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                            >
                              Resolver
                            </button>
                          )}
                          <button
                            onClick={() => handleEliminar(a.id)}
                            className="px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
