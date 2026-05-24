'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from '@/hooks/useSession';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Visita {
  id: number;
  nombre_visitante: string;
  rut_visitante?: string;
  depto_destino: string;
  residente_nombre?: string;
  motivo: string;
  patente?: string;
  spot_asignado?: string;
  hora_entrada: string;
  hora_salida?: string;
  tenant_id: number;
}

type DateRange = 'hoy' | 'semana' | 'todos';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch { return '—'; }
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

function calcDuration(entrada: string, salida?: string): string {
  const end = salida ? new Date(salida).getTime() : Date.now();
  const start = new Date(entrada).getTime();
  if (isNaN(start)) return '—';
  const mins = Math.max(0, Math.floor((end - start) / 60000));
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function isToday(iso: string) {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function isThisWeek(iso: string) {
  const d = new Date(iso).getTime();
  const now = Date.now();
  return now - d <= 7 * 24 * 60 * 60 * 1000;
}

function MotivoBadge({ motivo }: { motivo: string }) {
  const map: Record<string, string> = {
    visita:    'bg-indigo-50 text-indigo-700',
    delivery:  'bg-amber-50 text-amber-700',
    proveedor: 'bg-violet-50 text-violet-700',
    tecnico:   'bg-sky-50 text-sky-700',
    otro:      'bg-slate-100 text-slate-600',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${map[motivo] ?? map.otro}`}>
      {motivo}
    </span>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm mt-0.5 opacity-80">{label}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick register salida inline (reuse from central logic)
// ---------------------------------------------------------------------------
function SalidaButton({ visitaId, onDone }: { visitaId: number; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  async function handle() {
    setLoading(true);
    try {
      await fetch(`/api/visitas/${visitaId}/salida`, { method: 'PATCH' });
      onDone();
    } catch {/* silenced */} finally {
      setLoading(false);
    }
  }
  return (
    <button
      onClick={handle}
      disabled={loading}
      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors whitespace-nowrap"
    >
      {loading ? '…' : 'Registrar Salida'}
    </button>
  );
}

// ---------------------------------------------------------------------------
// PAGE
// ---------------------------------------------------------------------------
export default function VisitasPage() {
  const { tenantId, loading: sessionLoading } = useSession();

  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [fetching, setFetching] = useState(true);

  // Filters
  const [soloActivas, setSoloActivas] = useState(false);
  const [deptoSearch, setDeptoSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>('hoy');

  const fetchVisitas = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/visitas?tenant_id=${tenantId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setVisitas(Array.isArray(data) ? data : (data.items ?? []));
    } catch {/* silenced */} finally {
      setFetching(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchVisitas();
  }, [fetchVisitas]);

  // ── Computed stats ──
  const hoy = visitas.filter((v) => isToday(v.hora_entrada));
  const activas = visitas.filter((v) => !v.hora_salida);
  const finalizadas = visitas.filter((v) => v.hora_salida);

  const avgMinutes =
    finalizadas.length === 0
      ? 0
      : Math.round(
          finalizadas.reduce((acc, v) => {
            const diff = new Date(v.hora_salida!).getTime() - new Date(v.hora_entrada).getTime();
            return acc + diff / 60000;
          }, 0) / finalizadas.length
        );

  function avgLabel() {
    if (avgMinutes === 0) return '—';
    if (avgMinutes < 60) return `${avgMinutes} min`;
    return `${Math.floor(avgMinutes / 60)}h ${avgMinutes % 60}m`;
  }

  // ── Filter pipeline ──
  const filtered = visitas.filter((v) => {
    if (soloActivas && v.hora_salida) return false;
    if (deptoSearch.trim() && !v.depto_destino.toLowerCase().includes(deptoSearch.toLowerCase())) return false;
    if (dateRange === 'hoy' && !isToday(v.hora_entrada)) return false;
    if (dateRange === 'semana' && !isThisWeek(v.hora_entrada)) return false;
    return true;
  });

  function handleExportCSV() {
    alert('Próximamente: exportar historial de visitas en formato CSV');
  }

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 space-y-4">
      {/* ── HEADER ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Historial de Visitas 👥</h1>
          <p className="text-sm text-slate-500">Registro completo de ingresos y egresos del condominio</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors bg-white"
        >
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* ── STATS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Visitas hoy"
          value={hoy.length}
          color="bg-indigo-50 border-indigo-200 text-indigo-800"
        />
        <StatCard
          label="En el edificio ahora"
          value={activas.length}
          sub={activas.length === 0 ? 'Edificio sin visitas activas ✓' : undefined}
          color={activas.length === 0
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'}
        />
        <StatCard
          label="Promedio tiempo visita"
          value={avgLabel()}
          sub={`Basado en ${finalizadas.length} visita${finalizadas.length !== 1 ? 's' : ''} con salida`}
          color="bg-slate-50 border-slate-200 text-slate-700"
        />
        <StatCard
          label="Total registradas"
          value={visitas.length}
          color="bg-slate-50 border-slate-200 text-slate-700"
        />
      </div>

      {/* ── FILTERS ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          {/* Solo activas toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setSoloActivas((v) => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${soloActivas ? 'bg-indigo-600' : 'bg-slate-200'}`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${soloActivas ? 'translate-x-5' : 'translate-x-0.5'}`}
              />
            </div>
            <span className="text-sm font-medium text-slate-700">Solo activas</span>
            {soloActivas && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                {activas.length}
              </span>
            )}
          </label>

          {/* Date range */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['hoy', 'semana', 'todos'] as DateRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  dateRange === r
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {r === 'hoy' ? 'Hoy' : r === 'semana' ? 'Esta semana' : 'Todos'}
              </button>
            ))}
          </div>

          {/* Depto search */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={deptoSearch}
              onChange={(e) => setDeptoSearch(e.target.value)}
              placeholder="Buscar depto…"
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg w-36 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {deptoSearch && (
              <button onClick={() => setDeptoSearch('')} className="text-xs text-slate-400 hover:text-slate-700">
                Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── TABLE ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {fetching ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <span className="text-4xl mb-3">🚪</span>
            <p className="text-sm font-medium">No hay visitas que coincidan con los filtros</p>
            {dateRange === 'hoy' && !soloActivas && (
              <p className="text-xs text-slate-300 mt-1">No se registraron visitas hoy</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {[
                    'Entrada',
                    'Nombre',
                    'RUT',
                    'Depto',
                    'Residente',
                    'Motivo',
                    'Patente',
                    'Spot',
                    'Salida',
                    'Tiempo',
                    '',
                  ].map((h) => (
                    <th
                      key={h + Math.random()}
                      className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((v) => {
                  const activa = !v.hora_salida;
                  return (
                    <tr
                      key={v.id}
                      className={`transition-colors ${activa ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-slate-50'}`}
                    >
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-slate-600">
                        {formatDateTime(v.hora_entrada)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap font-medium text-slate-900">
                        <div className="flex items-center gap-1.5">
                          {activa && (
                            <span
                              className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0"
                              title="Actualmente en el edificio"
                            />
                          )}
                          {v.nombre_visitante}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-slate-500 font-mono">
                        {v.rut_visitante ?? '—'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-bold">
                          {v.depto_destino}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-slate-600 max-w-28 truncate">
                        {v.residente_nombre ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <MotivoBadge motivo={v.motivo} />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-slate-500 font-mono">
                        {v.patente ?? '—'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-slate-500">
                        {v.spot_asignado ?? '—'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-slate-600">
                        {v.hora_salida ? formatTime(v.hora_salida) : (
                          <span className="text-amber-600 font-medium">Activo</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs font-medium">
                        {activa ? (
                          <span className="text-amber-600">{calcDuration(v.hora_entrada)}</span>
                        ) : (
                          <span className="text-slate-500">{calcDuration(v.hora_entrada, v.hora_salida)}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {activa && (
                          <SalidaButton visitaId={v.id} onDone={fetchVisitas} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table footer */}
        {!fetching && filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
            <span>
              Mostrando {filtered.length} de {visitas.length} registros
              {soloActivas ? ' (solo activas)' : ''}
            </span>
            {activas.length > 0 && (
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                {activas.length} persona{activas.length !== 1 ? 's' : ''} en el edificio
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
