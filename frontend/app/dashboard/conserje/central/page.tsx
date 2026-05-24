'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from '@/hooks/useSession';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Puerta {
  id: number;
  nombre: string;
  ubicacion: string;
  estado: 'abierta' | 'cerrada' | string;
  modo: string;
}

interface Visita {
  id: number;
  nombre_visitante: string;
  rut_visitante?: string;
  depto_destino: string;
  motivo: string;
  patente?: string;
  spot_asignado?: string;
  hora_entrada: string;
}

interface Paquete {
  id: number;
  depto_destino: string;
  carrier: string;
  tracking_number?: string;
  nombre_destinatario?: string;
  estado: 'pendiente' | 'entregado' | string;
  created_at: string;
}

interface Spot {
  id: number;
  codigo: string;
  estado: 'libre' | 'ocupado' | string;
  patente?: string;
  nombre_conductor?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const CARRIER_LABELS: Record<string, string> = {
  chilexpress: 'Chilexpress',
  bluexpress: 'Bluexpress',
  mercadolibre: 'MercadoLibre',
  aliexpress: 'AliExpress',
  correos_chile: 'Correos Chile',
  starken: 'Starken',
  dhl: 'DHL',
  otro: 'Otro',
};

const MOTIVO_OPTIONS = [
  { value: 'visita',    label: 'Visita' },
  { value: 'delivery',  label: 'Delivery' },
  { value: 'proveedor', label: 'Proveedor' },
  { value: 'tecnico',   label: 'Técnico' },
  { value: 'otro',      label: 'Otro' },
];

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

function elapsedMinutes(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

// ---------------------------------------------------------------------------
// Flash message component
// ---------------------------------------------------------------------------
function FlashMessage({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border ${
        type === 'success'
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-red-50 border-red-200 text-red-700'
      }`}
    >
      <span>{type === 'success' ? '✓' : '⚠'}</span>
      {msg}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------
function SectionHeader({ title, badge }: { title: string; badge?: string | number }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{title}</h2>
      {badge !== undefined && (
        <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
          {badge}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BLOCK 1 — PUERTAS
// ---------------------------------------------------------------------------
function BlockPuertas({ tenantId }: { tenantId: number }) {
  const [puertas, setPuertas] = useState<Puerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const fetchPuertas = useCallback(async () => {
    try {
      const res = await fetch(`/api/condominios/puertas?tenant_id=${tenantId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPuertas(Array.isArray(data) ? data : (data.items ?? []));
    } catch {
      // silenced — global error handled by parent
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchPuertas(); }, [fetchPuertas]);

  async function handleAbrir(id: number, nombre: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/condominios/puertas/${id}/comando`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'abrir' }),
      });
      if (!res.ok) throw new Error();
      setFlash({ msg: `${nombre} abierta`, type: 'success' });
      setTimeout(() => setFlash(null), 3000);
      fetchPuertas();
    } catch {
      setFlash({ msg: 'Error al enviar comando', type: 'error' });
      setTimeout(() => setFlash(null), 4000);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col min-h-0">
      <SectionHeader title="🚪 Puertas" badge={puertas.length} />
      {flash && <div className="mb-3"><FlashMessage {...flash} /></div>}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : puertas.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2 py-6">
          <span className="text-3xl">🚪</span>
          <p className="text-sm">No hay puertas configuradas</p>
          <p className="text-xs text-slate-300">El administrador debe registrar las puertas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto">
          {puertas.map((puerta) => {
            const cerrada = puerta.estado === 'cerrada';
            return (
              <div
                key={puerta.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-white transition-colors"
              >
                {/* Animated dot */}
                <span className="relative flex-shrink-0">
                  <span
                    className={`w-3 h-3 rounded-full block ${cerrada ? 'bg-emerald-500' : 'bg-red-500'}`}
                  />
                  <span
                    className={`absolute inset-0 rounded-full animate-ping opacity-60 ${cerrada ? 'bg-emerald-400' : 'bg-red-400'}`}
                  />
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{puerta.nombre}</p>
                  <p className="text-xs text-slate-500 truncate">{puerta.ubicacion}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        cerrada
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {cerrada ? 'Cerrada' : 'Abierta'}
                    </span>
                    {puerta.modo && (
                      <span className="px-1.5 py-0.5 rounded text-xs bg-slate-200 text-slate-600">
                        {puerta.modo}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleAbrir(puerta.id, puerta.nombre)}
                  disabled={actionLoading === puerta.id}
                  className="flex-shrink-0 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {actionLoading === puerta.id ? '…' : 'Abrir'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BLOCK 2 — REGISTRAR VISITA
// ---------------------------------------------------------------------------
interface VisitaForm {
  nombre_visitante: string;
  rut_visitante: string;
  depto_destino: string;
  motivo: string;
  patente: string;
  spot_asignado: string;
}

function BlockRegistrarVisita({ tenantId, onVisitaRegistrada }: { tenantId: number; onVisitaRegistrada: () => void }) {
  const [form, setForm] = useState<VisitaForm>({
    nombre_visitante: '',
    rut_visitante: '',
    depto_destino: '',
    motivo: 'visita',
    patente: '',
    spot_asignado: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre_visitante.trim() || !form.depto_destino.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/visitas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tenant_id: tenantId }),
      });
      if (!res.ok) throw new Error();
      setFlash({
        msg: `✓ ${form.nombre_visitante} ingresado al depto ${form.depto_destino}`,
        type: 'success',
      });
      setForm({ nombre_visitante: '', rut_visitante: '', depto_destino: '', motivo: 'visita', patente: '', spot_asignado: '' });
      onVisitaRegistrada();
      setTimeout(() => setFlash(null), 5000);
    } catch {
      setFlash({ msg: 'Error al registrar visita', type: 'error' });
      setTimeout(() => setFlash(null), 4000);
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <SectionHeader title="👤 Registrar Visita" />
      {flash && <div className="mb-3"><FlashMessage {...flash} /></div>}

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Nombre visitante *</label>
          <input
            name="nombre_visitante"
            value={form.nombre_visitante}
            onChange={handleChange}
            required
            placeholder="Nombre completo"
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">RUT</label>
            <input
              name="rut_visitante"
              value={form.rut_visitante}
              onChange={handleChange}
              placeholder="12.345.678-9"
              className={inputCls}
            />
          </div>
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
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Motivo</label>
          <select name="motivo" value={form.motivo} onChange={handleChange} className={inputCls}>
            {MOTIVO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Patente</label>
            <input
              name="patente"
              value={form.patente}
              onChange={handleChange}
              placeholder="ABC-123"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Spot asignado</label>
            <input
              name="spot_asignado"
              value={form.spot_asignado}
              onChange={handleChange}
              placeholder="Ej: V-3"
              className={inputCls}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting || !form.nombre_visitante.trim() || !form.depto_destino.trim()}
          className="w-full py-2 px-4 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Registrando…' : 'Registrar Ingreso'}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BLOCK 3 — VISITAS ACTIVAS
// ---------------------------------------------------------------------------
function BlockVisitasActivas({ tenantId, refreshTrigger }: { tenantId: number; refreshTrigger: number }) {
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchVisitas = useCallback(async () => {
    try {
      const res = await fetch(`/api/visitas/activas?tenant_id=${tenantId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setVisitas(Array.isArray(data) ? data : (data.items ?? []));
    } catch {
      // silenced
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchVisitas(); }, [fetchVisitas, refreshTrigger]);

  async function handleSalida(id: number) {
    setActionLoading(id);
    try {
      await fetch(`/api/visitas/${id}/salida`, { method: 'PATCH' });
      fetchVisitas();
    } catch {
      // silenced
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <SectionHeader
        title="👥 Visitas Activas"
        badge={visitas.length > 0 ? `${visitas.length} persona${visitas.length !== 1 ? 's' : ''} en el edificio` : undefined}
      />

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : visitas.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-4 text-emerald-600">
          <span className="text-lg">✓</span>
          <p className="text-sm font-medium">Edificio sin visitas activas</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                {['Entrada', 'Nombre', 'Depto', 'Motivo', 'Patente', 'Spot', 'Tiempo', ''].map((h) => (
                  <th key={h} className="pb-2 pr-3 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visitas.map((v) => (
                <tr key={v.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2 pr-3 whitespace-nowrap text-slate-600">{formatTime(v.hora_entrada)}</td>
                  <td className="py-2 pr-3 font-medium text-slate-900 whitespace-nowrap">{v.nombre_visitante}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">{v.depto_destino}</span>
                  </td>
                  <td className="py-2 pr-3 text-slate-600 whitespace-nowrap capitalize">{v.motivo}</td>
                  <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">{v.patente ?? '—'}</td>
                  <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">{v.spot_asignado ?? '—'}</td>
                  <td className="py-2 pr-3 text-amber-600 whitespace-nowrap font-medium">{elapsedMinutes(v.hora_entrada)}</td>
                  <td className="py-2 whitespace-nowrap">
                    <button
                      onClick={() => handleSalida(v.id)}
                      disabled={actionLoading === v.id}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {actionLoading === v.id ? '…' : 'Registrar Salida'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BLOCK 4 — PAQUETERÍA
// ---------------------------------------------------------------------------
interface PaqueteForm {
  depto_destino: string;
  carrier: string;
  tracking_number: string;
  nombre_destinatario: string;
}

function BlockPaqueteria({ tenantId }: { tenantId: number }) {
  const [form, setForm] = useState<PaqueteForm>({
    depto_destino: '',
    carrier: 'chilexpress',
    tracking_number: '',
    nombre_destinatario: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [pendientes, setPendientes] = useState<Paquete[]>([]);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchPendientes = useCallback(async () => {
    try {
      const res = await fetch(`/api/paqueteria/pendientes?tenant_id=${tenantId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPendientes(Array.isArray(data) ? data : (data.items ?? []));
    } catch {/* silenced */}
  }, [tenantId]);

  useEffect(() => { fetchPendientes(); }, [fetchPendientes]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.depto_destino.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/paqueteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tenant_id: tenantId }),
      });
      if (!res.ok) throw new Error();
      setFlash({ msg: `📦 Paquete registrado - notificación enviada a Depto ${form.depto_destino}`, type: 'success' });
      setForm({ depto_destino: '', carrier: 'chilexpress', tracking_number: '', nombre_destinatario: '' });
      fetchPendientes();
      setTimeout(() => setFlash(null), 5000);
    } catch {
      setFlash({ msg: 'Error al registrar paquete', type: 'error' });
      setTimeout(() => setFlash(null), 4000);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEntregar(id: number) {
    setActionLoading(id);
    try {
      await fetch(`/api/paqueteria/${id}/entregar`, { method: 'PATCH' });
      fetchPendientes();
    } catch {/* silenced */} finally {
      setActionLoading(null);
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col">
      <SectionHeader title="📦 Paquetería" badge={pendientes.length > 0 ? `${pendientes.length} pendiente${pendientes.length !== 1 ? 's' : ''}` : undefined} />
      {flash && <div className="mb-3"><FlashMessage {...flash} /></div>}

      <form onSubmit={handleSubmit} className="space-y-2 mb-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Depto *</label>
            <input
              name="depto_destino"
              value={form.depto_destino}
              onChange={handleChange}
              required
              placeholder="Ej: 3A"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Carrier</label>
            <select name="carrier" value={form.carrier} onChange={handleChange} className={inputCls}>
              {Object.entries(CARRIER_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tracking</label>
            <input
              name="tracking_number"
              value={form.tracking_number}
              onChange={handleChange}
              placeholder="Nro. de seguimiento"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Destinatario</label>
            <input
              name="nombre_destinatario"
              value={form.nombre_destinatario}
              onChange={handleChange}
              placeholder="Nombre"
              className={inputCls}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting || !form.depto_destino.trim()}
          className="w-full py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Registrando…' : '+ Registrar Paquete'}
        </button>
      </form>

      {/* Pending list */}
      {pendientes.length > 0 && (
        <div className="space-y-1.5 overflow-y-auto max-h-40">
          {pendientes.map((pkg) => (
            <div key={pkg.id} className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-100">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-900">Depto {pkg.depto_destino}</p>
                <p className="text-xs text-slate-500 truncate">{CARRIER_LABELS[pkg.carrier] ?? pkg.carrier} {pkg.tracking_number ? `• ${pkg.tracking_number}` : ''}</p>
              </div>
              <button
                onClick={() => handleEntregar(pkg.id)}
                disabled={actionLoading === pkg.id}
                className="flex-shrink-0 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading === pkg.id ? '…' : 'Entregar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BLOCK 5 — ESTACIONAMIENTO
// ---------------------------------------------------------------------------
interface SpotModalData {
  spot: Spot;
}

function BlockEstacionamiento({ tenantId }: { tenantId: number }) {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<SpotModalData | null>(null);
  const [assignForm, setAssignForm] = useState({ patente: '', nombre_conductor: '' });
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchSpots = useCallback(async () => {
    try {
      const res = await fetch(`/api/estacionamientos?tenant_id=${tenantId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSpots(Array.isArray(data) ? data : (data.items ?? []));
    } catch {/* silenced */} finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchSpots(); }, [fetchSpots]);

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!modal || !assignForm.patente.trim()) return;
    setSubmitting(true);
    try {
      await fetch(`/api/estacionamientos/${modal.spot.id}/asignar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignForm),
      });
      setModal(null);
      setAssignForm({ patente: '', nombre_conductor: '' });
      fetchSpots();
    } catch {/* silenced */} finally {
      setSubmitting(false);
    }
  }

  async function handleLiberar(id: number) {
    setActionLoading(id);
    try {
      await fetch(`/api/estacionamientos/${id}/liberar`, { method: 'PATCH' });
      fetchSpots();
    } catch {/* silenced */} finally {
      setActionLoading(null);
    }
  }

  const libres = spots.filter((s) => s.estado === 'libre').length;
  const ocupados = spots.filter((s) => s.estado === 'ocupado').length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <SectionHeader title="🚗 Estacionamientos" />

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : spots.length === 0 ? (
        <div className="text-center py-6 text-slate-400">
          <p className="text-sm">No hay spots configurados</p>
          <p className="text-xs text-slate-300 mt-1">El administrador debe crear los spots</p>
        </div>
      ) : (
        <>
          <div className="flex gap-3 mb-3 text-xs">
            <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold">{libres} libres</span>
            <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 font-semibold">{ocupados} ocupados</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
            {spots.map((spot) => {
              const libre = spot.estado === 'libre';
              return (
                <button
                  key={spot.id}
                  onClick={() => {
                    if (libre) {
                      setModal({ spot });
                    } else {
                      handleLiberar(spot.id);
                    }
                  }}
                  disabled={actionLoading === spot.id}
                  title={libre ? `Asignar ${spot.codigo}` : `Liberar ${spot.codigo} (${spot.patente ?? ''})`}
                  className={`flex flex-col items-center p-2 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-50 ${
                    libre
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                  }`}
                >
                  <span className="text-base mb-0.5">{libre ? '🟢' : '🔴'}</span>
                  <span>{spot.codigo}</span>
                  {!libre && spot.patente && (
                    <span className="text-red-500 font-normal truncate max-w-full">{spot.patente}</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Assign Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Asignar spot {modal.spot.codigo}</h3>
            <form onSubmit={handleAssign} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Patente *</label>
                <input
                  value={assignForm.patente}
                  onChange={(e) => setAssignForm((p) => ({ ...p, patente: e.target.value }))}
                  required
                  placeholder="ABC-123"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Conductor</label>
                <input
                  value={assignForm.nombre_conductor}
                  onChange={(e) => setAssignForm((p) => ({ ...p, nombre_conductor: e.target.value }))}
                  placeholder="Nombre del conductor"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setModal(null); setAssignForm({ patente: '', nombre_conductor: '' }); }}
                  className="flex-1 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !assignForm.patente.trim()}
                  className="flex-1 py-2 text-sm bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? '…' : 'Asignar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PAGE
// ---------------------------------------------------------------------------
export default function CentralPage() {
  const { user, tenantId, loading } = useSession();

  const [now, setNow] = useState(new Date());
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [apiError, setApiError] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  // Clock: update every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // API health check + shared 15s refresh
  useEffect(() => {
    if (!tenantId) return;

    async function checkHealth() {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        setApiOnline(res.ok);
        setApiError(!res.ok);
      } catch {
        setApiOnline(false);
        setApiError(true);
      }
    }

    checkHealth();
    const healthId = setInterval(checkHealth, 30000);
    const refreshId = setInterval(() => setRefreshTick((t) => t + 1), 15000);

    return () => {
      clearInterval(healthId);
      clearInterval(refreshId);
    };
  }, [tenantId]);

  if (loading || !tenantId) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen bg-slate-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const dateStr = now.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="min-h-full bg-slate-50 p-4 space-y-4">
      {/* ── HEADER ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Central de Conserjería 🏢</h1>
          <p className="text-sm text-slate-500 capitalize mt-0.5">{dateStr}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-2xl font-mono font-bold text-indigo-600 leading-none">{timeStr}</p>
          </div>
          {apiOnline !== null && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${apiOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              <span className={`w-2 h-2 rounded-full ${apiOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              {apiOnline ? '● Sistema en línea' : '● Sin conexión'}
            </div>
          )}
        </div>
      </div>

      {/* ── GLOBAL ERROR BANNER ── */}
      {apiError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
          <span>⚠</span>
          <span>Error de conexión — algunos datos pueden estar desactualizados. Reintentando…</span>
        </div>
      )}

      {/* ── ROW 1: Puertas (2/3) + Registrar Visita (1/3) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <BlockPuertas tenantId={tenantId} />
        </div>
        <div className="lg:col-span-1">
          <BlockRegistrarVisita tenantId={tenantId} onVisitaRegistrada={() => setRefreshTick((t) => t + 1)} />
        </div>
      </div>

      {/* ── ROW 2: Visitas Activas (full width) ── */}
      <BlockVisitasActivas tenantId={tenantId} refreshTrigger={refreshTick} />

      {/* ── ROW 3: Paquetería (1/2) + Estacionamiento (1/2) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BlockPaqueteria tenantId={tenantId} />
        <BlockEstacionamiento tenantId={tenantId} />
      </div>

      {/* ── FOOTER HINT ── */}
      <p className="text-center text-xs text-slate-300 pb-2">
        Actualización automática cada 15 s · Operador: {user?.nombre_completo ?? '—'}
      </p>
    </div>
  );
}
