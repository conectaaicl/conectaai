"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/hooks/useSession";

interface Conserje {
  id: number;
  nombre_completo: string;
  email: string;
  turno: string;
  telefono?: string;
  activo: boolean;
  ultimo_acceso?: string;
}

const TURNOS = [
  { value: "manana", label: "Mañana" },
  { value: "tarde", label: "Tarde" },
  { value: "noche", label: "Noche" },
  { value: "rotativo", label: "Rotativo" },
];

const turnoLabel = (t: string) => TURNOS.find((x) => x.value === t)?.label ?? t;

const turnoColor: Record<string, string> = {
  manana: "bg-amber-100 text-amber-800",
  tarde: "bg-blue-100 text-blue-800",
  noche: "bg-indigo-100 text-indigo-800",
  rotativo: "bg-purple-100 text-purple-800",
};

function formatDate(iso?: string) {
  if (!iso) return "Nunca";
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

interface ConserjeFormData {
  nombre_completo: string;
  email: string;
  password: string;
  turno: string;
  telefono: string;
}

const emptyForm: ConserjeFormData = {
  nombre_completo: "",
  email: "",
  password: "",
  turno: "manana",
  telefono: "",
};

export default function ConserjesPage() {
  const { tenantId, loading } = useSession();
  const [conserjes, setConserjes] = useState<Conserje[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Conserje | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [form, setForm] = useState<ConserjeFormData>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchConserjes = useCallback(async () => {
    if (!tenantId) return;
    setFetching(true);
    setError(null);
    try {
      const res = await fetch(`/api/conserje/usuarios?tenant_id=${tenantId}`);
      if (!res.ok) throw new Error("Error al cargar conserjes");
      const data = await res.json();
      setConserjes(Array.isArray(data) ? data : (data.usuarios ?? []));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setFetching(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!loading) fetchConserjes();
  }, [loading, fetchConserjes]);

  const openCreate = () => {
    setForm(emptyForm);
    setFormError(null);
    setShowCreate(true);
  };

  const openEdit = (c: Conserje) => {
    setEditTarget(c);
    setForm({
      nombre_completo: c.nombre_completo,
      email: c.email,
      password: "",
      turno: c.turno,
      telefono: c.telefono ?? "",
    });
    setFormError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) {
      setFormError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/conserje/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tenant_id: tenantId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(d.message ?? "Error al crear conserje");
      }
      setShowCreate(false);
      fetchConserjes();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    if (form.password && form.password.length < 6) {
      setFormError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const body: Record<string, string | boolean> = {
      nombre_completo: form.nombre_completo,
      email: form.email,
      turno: form.turno,
      telefono: form.telefono,
    };
    if (form.password) body.password = form.password;
    try {
      const res = await fetch(`/api/conserje/usuarios/${editTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(d.message ?? "Error al actualizar conserje");
      }
      setEditTarget(null);
      fetchConserjes();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActivo = async (c: Conserje) => {
    try {
      const res = await fetch(`/api/conserje/usuarios/${c.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !c.activo }),
      });
      if (!res.ok) throw new Error("Error");
      fetchConserjes();
    } catch {
      alert("No se pudo cambiar el estado del conserje.");
    }
  };

  const resetPassword = async (c: Conserje) => {
    if (!confirm(`¿Resetear la contraseña de ${c.nombre_completo}?`)) return;
    try {
      const res = await fetch(`/api/conserje/usuarios/${c.id}/reset-password`, { method: "POST" });
      if (!res.ok) throw new Error("Error");
      const data = await res.json() as { password?: string; nueva_password?: string };
      setGeneratedPassword(data.password ?? data.nueva_password ?? "Ver en el sistema");
    } catch {
      alert("No se pudo resetear la contraseña.");
    }
  };

  function ConserjeFormFields({ isEdit }: { isEdit?: boolean }) {
    return (
      <>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.nombre_completo}
              onChange={(e) => setForm((f) => ({ ...f, nombre_completo: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Juan Pérez"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="conserje@edificio.cl"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isEdit ? "Contraseña (dejar vacío para no cambiar)" : "Contraseña *"}
            </label>
            <input
              type="password"
              required={!isEdit}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={isEdit ? "Sin cambios" : "Mínimo 6 caracteres"}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Turno</label>
              <select
                value={form.turno}
                onChange={(e) => setForm((f) => ({ ...f, turno: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TURNOS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                type="tel"
                value={form.telefono}
                onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+56 9 1234 5678"
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
            onClick={() => { setShowCreate(false); setEditTarget(null); }}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear conserje"}
          </button>
        </div>
      </>
    );
  }

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
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Conserjes</h1>
          <p className="text-sm text-gray-500 mt-1">Administra las cuentas de acceso del personal de conserjería</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Conserje
        </button>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-6">
        <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-blue-700">
          Los conserjes acceden desde <span className="font-mono font-semibold">/login</span> con sus credenciales. Se les redirige automáticamente a su panel de trabajo.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
          {error}
          <button onClick={fetchConserjes} className="ml-3 underline font-medium">Reintentar</button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {fetching ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : conserjes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">Aún no hay conserjes registrados</h3>
            <p className="text-sm text-gray-500 max-w-xs mb-5">Crea el primer usuario de conserjería para que pueda acceder al sistema.</p>
            <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
              + Nuevo Conserje
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Turno</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Último acceso</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {conserjes.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.nombre_completo}</td>
                    <td className="px-4 py-3 text-gray-600">{c.email}</td>
                    <td className="px-4 py-3">
                      <span className={"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium " + (turnoColor[c.turno] ?? "bg-gray-100 text-gray-700")}>
                        {turnoLabel(c.turno)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.activo ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(c.ultimo_acceso)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(c)} className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">Editar</button>
                        <button
                          onClick={() => toggleActivo(c)}
                          className={"px-3 py-1.5 text-xs font-medium rounded-lg transition-colors " + (c.activo ? "text-orange-700 bg-orange-50 hover:bg-orange-100" : "text-green-700 bg-green-50 hover:bg-green-100")}
                        >
                          {c.activo ? "Desactivar" : "Activar"}
                        </button>
                        <button onClick={() => resetPassword(c)} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Reset pwd</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <Modal title="Nuevo Conserje" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}><ConserjeFormFields /></form>
        </Modal>
      )}

      {editTarget && (
        <Modal title={`Editar — ${editTarget.nombre_completo}`} onClose={() => setEditTarget(null)}>
          <form onSubmit={handleEdit}><ConserjeFormFields isEdit /></form>
        </Modal>
      )}

      {generatedPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Contraseña reseteada</h2>
            </div>
            <p className="text-sm text-gray-600 mb-3">La nueva contraseña generada es:</p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 font-mono text-lg font-bold text-gray-900 text-center tracking-wider mb-5">
              {generatedPassword}
            </div>
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mb-4">
              Copia esta contraseña ahora. No se mostrará de nuevo.
            </p>
            <button onClick={() => setGeneratedPassword(null)} className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
