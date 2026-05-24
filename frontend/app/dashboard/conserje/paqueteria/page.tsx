'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from '@/hooks/useSession';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Paquete {
  id: number;
  depto_destino: string;
  carrier: string;
  tracking_number?: string;
  nombre_destinatario?: string;
  estado: 'pendiente' | 'entregado' | string;
  registrado_por?: string;
  created_at: string;
  entregado_at?: string;
  tenant_id: number;
}

interface Stats {
  pendientes: number;
  entregados_hoy: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CARRIERS = [
  { value: 'todos',          label: 'Todos los carriers',  color: '' },
  { value: 'chilexpress',    label: 'Chilexpress',         color: 'bg-red-100 text-red-700' },
  { value: 'bluexpress',     label: 'Bluexpress',          color: 'bg-blue-100 text-blue-700' },
  { value: 'mercadolibre',   label: 'MercadoLibre',        color: 'bg-yellow-100 text-yellow-700' },
  { value: 'aliexpress',     label: 'AliExpress',          color: 'bg-orange-100 text-orange-700' },
  { value: 'correos_chile',  label: 'Correos Chile',       color: 'bg-purple-100 text-purple-700' },
  { value: 'starken',        label: 'Starken',             color: 'bg-sky-100 text-sky-700' },
  { value: 'dhl',            label: 'DHL',                 color: 'bg-amber-100 text-amber-800' },
  { value: 'otro',           label: 'Otro',                color: 'bg-slate-100 text-slate-600' },
];

const CARRIER_MAP = Object.fromEntries(CARRIERS.map((c) => [c.value, c]));

interface PaqueteFormState {
  depto_destino: string;
  carrier: string;
  tracking_number: string;
  nombre_destinatario: string;
  notas: string;
}

const FORM_EMPTY: PaqueteFormState = {
  depto_destino: '',
  carrier: 'chilexpress',
  tracking_number: '',
  nombre_destinatario: '',
  notas: '',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function CarrierBadge({ carrier }: { carrier: string }) {
  const info = CARRIER_MAP[carrier] ?? CARRIER_MAP['otro'];
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${info.color || 'bg-slate-100 text-slate-600'}`}>
      {info.label}
    </span>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm mt-0.5 opacity-80">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Register form (collapsible)
// ---------------------------------------------------------------------------
function RegisterForm({ tenantId, onSuccess }: { tenantId: number; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PaqueteFormState>(FORM_EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.depto_destino.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/paqueteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tenant_id: tenantId }),
      });
      if (!res.ok) throw new Error();
      setFlash(`📦 Paquete registrado — notificación enviada a Depto ${form.depto_destino}`);
      setForm(FORM_EMPTY);
      onSuccess();
      setTimeout(() => setFlash(null), 5000);
    } catch {
      setError('Error al registrar el paquete. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-base">📦</span>
          + Registrar Paquete
        </span>
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-slate-100">
          {flash && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
              {flash}
            </div>
          )}
          {error && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Depto destino *</label>
              <input
                name="depto_destino"
                value={form.depto_destino}
                onChange={handleChange}
                required
                placeholder="Ej: 4B"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Carrier *</label>
              <select name="carrier" value={form.carrier} onChange={handleChange} className={inputCls}>
                {CARRIERS.filter((c) => c.value !== 'todos').map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nro. de tracking</label>
              <input
                name="tracking_number"
                value={form.tracking_number}
                onChange={handleChange}
                placeholder="Opcional"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre destinatario</label>
              <input
                name="nombre_destinatario"
                value={form.nombre_destinatario}
                onChange={handleChange}
                placeholder="Residente"
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
              <input
                name="notas"
                value={form.notas}
                onChange={handleChange}
                placeholder="Observaciones (opcional)"
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <button
                type="submit"
                disabled={submitting || !form.depto_destino.trim()}
                className="px-6 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Registrando…' : 'Registrar Paquete'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PAGE
// ---------------------------------------------------------------------------
export default function PaqueteriaPage() {
  const { tenantId, loading } = useSession();

  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [fetching, setFetching] = useState(true);
  const [stats, setStats] = useState<Stats>({ pendientes: 0, entregados_hoy: 0, total: 0 });

  // Filters
  const [estadoFilter, setEstadoFilter] = useState<'todos' | 'pendiente' | 'entregado'>('todos');
  const [carrierFilter, setCarrierFilter] = useState('todos');
  const [deptoSearch, setDeptoSearch] = useState('');

  // Action state
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchPaquetes = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/paqueteria?tenant_id=${tenantId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const list: Paquete[] = Array.isArray(data) ? data : (data.items ?? []);
      setPaquetes(list);

      // Compute stats client-side (or use server endpoint if available)
      const pendientes = list.filter((p) => p.estado === 'pendiente').length;
      const entregados_hoy = list.filter(
        (p) => p.estado === 'entregado' && p.entregado_at && isToday(p.entregado_at)
      ).length;
      setStats({ pendientes, entregados_hoy, total: list.length });
    } catch {
      // silenced
    } finally {
      setFetching(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchPaquetes();
  }, [fetchPaquetes]);

  async function handleEntregar(id: number) {
    setActionLoading(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/paqueteria/${id}/entregar`, { method: 'PATCH' });
      if (!res.ok) throw new Error();
      fetchPaquetes();
    } catch {
      setActionError('Error al marcar como entregado');
      setTimeout(() => setActionError(null), 4000);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleEliminar(id: number) {
    if (!confirm('¿Eliminar este registro de paquete?')) return;
    setActionLoading(id);
    try {
      await fetch(`/api/paqueteria/${id}`, { method: 'DELETE' });
      fetchPaquetes();
    } catch {/* silenced */} finally {
      setActionLoading(null);
    }
  }

  // Filter pipeline
  const filtered = paquetes.filter((p) => {
    if (estadoFilter !== 'todos' && p.estado !== estadoFilter) return false;
    if (carrierFilter !== 'todos' && p.carrier !== carrierFilter) return false;
    if (deptoSearch.trim() && !p.depto_destino.toLowerCase().includes(deptoSearch.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 space-y-4">
      {/* ── HEADER ── */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Paquetería 📦</h1>
        <p className="text-sm text-slate-500">Gestión de paquetes y encomiendas del condominio</p>
      </div>

      {/* ── STATS ── */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Pendientes de entrega" value={stats.pendientes} color="bg-amber-50 border-amber-200 text-amber-800" />
        <StatCard label="Entregados hoy"         value={stats.entregados_hoy} color="bg-emerald-50 border-emerald-200 text-emerald-800" />
        <StatCard label="Total registrados"      value={stats.total} color="bg-indigo-50 border-indigo-200 text-indigo-800" />
      </div>

      {/* ── REGISTER FORM ── */}
      {tenantId && <RegisterForm tenantId={tenantId} onSuccess={fetchPaquetes} />}

      {/* ── FILTERS ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        {/* Estado filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Estado:</span>
          {(['todos', 'pendiente', 'entregado'] as const).map((e) => (
            <button
              key={e}
              onClick={() => setEstadoFilter(e)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors capitalize ${
                estadoFilter === e
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {e === 'todos' ? 'Todos' : e === 'pendiente' ? 'Pendientes' : 'Entregados'}
            </button>
          ))}
        </div>

        {/* Carrier filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Carrier:</span>
          {CARRIERS.map((c) => (
            <button
              key={c.value}
              onClick={() => setCarrierFilter(c.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                carrierFilter === c.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Depto search */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Depto:</span>
          <input
            type="text"
            value={deptoSearch}
            onChange={(e) => setDeptoSearch(e.target.value)}
            placeholder="Buscar depto…"
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg w-40 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {deptoSearch && (
            <button onClick={() => setDeptoSearch('')} className="text-xs text-slate-400 hover:text-slate-600">
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* ── ERROR ── */}
      {actionError && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
          ⚠ {actionError}
        </div>
      )}

      {/* ── TABLE ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {fetching ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <span className="text-4xl mb-3">📭</span>
            <p className="text-sm font-medium">No hay paquetes que coincidan con los filtros</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {[
                    'Recibido',
                    'Carrier',
                    'Depto',
                    'Destinatario',
                    'Tracking',
                    'Estado',
                    'Registrado por',
                    'Acciones',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 text-xs">
                      {formatDateTime(pkg.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <CarrierBadge carrier={pkg.carrier} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-bold">
                        {pkg.depto_destino}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-32 truncate">
                      {pkg.nombre_destinatario ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs font-mono max-w-28 truncate">
                      {pkg.tracking_number ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          pkg.estado === 'pendiente'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {pkg.estado === 'pendiente' ? 'Pendiente' : 'Entregado'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {pkg.registrado_por ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {pkg.estado === 'pendiente' && (
                          <button
                            onClick={() => handleEntregar(pkg.id)}
                            disabled={actionLoading === pkg.id}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                          >
                            {actionLoading === pkg.id ? '…' : 'Entregar'}
                          </button>
                        )}
                        <button
                          onClick={() => handleEliminar(pkg.id)}
                          disabled={actionLoading === pkg.id}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
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

        {/* Table footer */}
        {!fetching && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
            Mostrando {filtered.length} de {paquetes.length} paquetes
          </div>
        )}
      </div>
    </div>
  );
}
