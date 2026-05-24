'use client'
import { useState, useEffect } from 'react'
import { useSession } from '@/hooks/useSession'

interface Persona {
  id: number
  nombre_completo: string
  rut: string
  telefono: string
  email: string
  roles: string[]
  estado: string
  datos_contacto: any
}

interface Condominio { id: number; nombre: string }
interface Puerta { id: number; nombre: string; descripcion?: string }

interface TarjetaRFID {
  id: number
  uid: string
  tipo_tarjeta: string
  nombre_titular: string
  categoria: string
  activa: boolean
  created_at: string
}

interface HistorialEvento {
  id: number
  modulo: string
  accion: string
  descripcion: string
  fecha: string
}

const ROLES_RESIDENTES = ['propietario', 'residente', 'arrendatario'] as const
type RolResidente = typeof ROLES_RESIDENTES[number]

const ROL_CONFIG: Record<RolResidente, { label: string; desc: string; badge: string; bg: string; border: string }> = {
  propietario: { label: 'Propietario', desc: 'Dueño/a del departamento', badge: 'bg-violet-100 text-violet-700', bg: 'bg-violet-50', border: 'border-violet-300' },
  residente: { label: 'Residente', desc: 'Vive en el departamento', badge: 'bg-indigo-100 text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-300' },
  arrendatario: { label: 'Arrendatario', desc: 'Arrienda el departamento', badge: 'bg-emerald-100 text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300' },
}

const TIPO_TARJETA_OPTIONS = [
  { value: 'mifare_classic', label: 'MIFARE Classic' },
  { value: 'hid', label: 'HID' },
  { value: 'em4100', label: 'EM4100' },
  { value: 'otro', label: 'Otro' },
]

const ACCION_ICON: Record<string, string> = {
  crear: '🟢', editar: '✏️', eliminar: '🔴',
  acceso_asignado: '🔑', acceso_revocado: '🚫', default: '📋',
}

function fmtDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const ESTADO_CONFIG: Record<string, string> = {
  activo: 'bg-emerald-100 text-emerald-700',
  suspendido: 'bg-amber-100 text-amber-700',
  inactivo: 'bg-slate-100 text-slate-500',
}

export default function PersonasPage() {
  const { tenantId } = useSession()
  const [personas, setPersonas] = useState<Persona[]>([])
  const [condominios, setCondominios] = useState<Condominio[]>([])
  const [puertas, setPuertas] = useState<Puerta[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null)
  const [modalTab, setModalTab] = useState<'datos' | 'acceso' | 'historial' | 'portal'>('datos')
  const [filtroRol, setFiltroRol] = useState<RolResidente | 'todos'>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [formData, setFormData] = useState({
    nombre_completo: '', rut: '', telefono: '', email: '',
    roles: ['residente'] as string[], estado: 'activo',
    datos_contacto: {
      condominio_id: '', torre: '', piso: '', departamento: '',
      telefono_emergencia: '', contacto_emergencia: '', familiares: [] as any[],
    },
  })

  const [tarjetasPersona, setTarjetasPersona] = useState<TarjetaRFID[]>([])
  const [accesoForm, setAccesoForm] = useState({ uid: '', tipo_tarjeta: 'mifare_classic', puertas: [] as number[] })
  const [guardandoAcceso, setGuardandoAcceso] = useState(false)
  const [accesoMsg, setAccesoMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [historial, setHistorial] = useState<HistorialEvento[]>([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)
  const [portalCuenta, setPortalCuenta] = useState<any>(null)
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [portalPass, setPortalPass] = useState('')
  const [portalDeptoId, setPortalDeptoId] = useState('')
  const [portalMsg, setPortalMsg] = useState<{type:'ok'|'err';text:string}|null>(null)
  const [portalCreado, setPortalCreado] = useState<{rut:string;password:string}|null>(null)

  useEffect(() => { if (tenantId) fetchData() }, [tenantId])

  async function fetchData() {
    if (!tenantId) return
    setLoading(true)
    try {
      const [pRes, cRes, puRes] = await Promise.all([
        fetch('/api/personas?tenant_id=' + tenantId),
        fetch('/api/condominios?tenant_id=' + tenantId),
        fetch('/api/condominios/puertas?tenant_id=' + tenantId),
      ])
      if (pRes.ok) {
        const all: Persona[] = await pRes.json()
        setPersonas(all.filter(p => p.roles.some(r => ROLES_RESIDENTES.includes(r as RolResidente))))
      }
      if (cRes.ok) setCondominios(await cRes.json())
      if (puRes.ok) {
        const data = await puRes.json()
        setPuertas(Array.isArray(data) ? data : [])
      }
    } finally { setLoading(false) }
  }

  function openNew() {
    setFormData({
      nombre_completo: '', rut: '', telefono: '', email: '',
      roles: ['residente'], estado: 'activo',
      datos_contacto: { condominio_id: '', torre: '', piso: '', departamento: '', telefono_emergencia: '', contacto_emergencia: '', familiares: [] },
    })
    setEditingPersona(null)
    setTarjetasPersona([])
    setHistorial([])
    setAccesoForm({ uid: '', tipo_tarjeta: 'mifare_classic', puertas: [] })
    setAccesoMsg(null)
    setPortalCuenta(null)
    setPortalMsg(null)
    setPortalCreado(null)
    setPortalPass('')
    setPortalDeptoId('')
    setModalTab('datos')
    setShowModal(true)
  }

  function openEdit(persona: Persona) {
    setFormData({
      nombre_completo: persona.nombre_completo, rut: persona.rut,
      telefono: persona.telefono || '', email: persona.email || '',
      roles: persona.roles, estado: persona.estado,
      datos_contacto: persona.datos_contacto || { condominio_id: '', torre: '', piso: '', departamento: '', telefono_emergencia: '', contacto_emergencia: '', familiares: [] },
    })
    setEditingPersona(persona)
    setTarjetasPersona([])
    setHistorial([])
    setAccesoForm({ uid: '', tipo_tarjeta: 'mifare_classic', puertas: [] })
    setAccesoMsg(null)
    setPortalCuenta(null)
    setPortalMsg(null)
    setPortalCreado(null)
    setPortalPass('')
    setPortalDeptoId('')
    setModalTab('datos')
    setShowModal(true)
  }

  function closeModal() { setShowModal(false); setEditingPersona(null) }

  async function handleTabChange(tab: 'datos' | 'acceso' | 'historial' | 'portal') {
    setModalTab(tab)
    if (!editingPersona) return
    if (tab === 'acceso' && tarjetasPersona.length === 0) {
      const r = await fetch('/api/personas/' + editingPersona.id + '/acceso?tenant_id=' + tenantId)
      if (r.ok) setTarjetasPersona(await r.json())
    }
    if (tab === 'historial' && historial.length === 0) {
      setLoadingHistorial(true)
      const r = await fetch('/api/personas/' + editingPersona.id + '/historial?tenant_id=' + tenantId)
      if (r.ok) setHistorial(await r.json())
      setLoadingHistorial(false)
    }
    if (tab === 'portal') {
      setLoadingPortal(true)
      const r = await fetch('/api/personas/' + editingPersona.id + '/portal-cuenta?tenant_id=' + tenantId)
      if (r.ok) setPortalCuenta(await r.json())
      setLoadingPortal(false)
    }
  }

  function toggleRole(role: string) {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(role) ? prev.roles.filter(r => r !== role) : [...prev.roles, role],
    }))
  }

  function togglePuerta(id: number) {
    setAccesoForm(prev => ({
      ...prev,
      puertas: prev.puertas.includes(id) ? prev.puertas.filter(p => p !== id) : [...prev.puertas, id],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (formData.roles.length === 0) { setMsg({ type: 'err', text: 'Selecciona al menos un rol.' }); return }
    try {
      const url = editingPersona ? '/api/personas/' + editingPersona.id : '/api/personas'
      const method = editingPersona ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, tenant_id: tenantId }),
      })
      if (res.ok) {
        const saved = await res.json()
        if (!editingPersona) setEditingPersona(saved)
        closeModal()
        fetchData()
        setMsg({ type: 'ok', text: editingPersona ? 'Residente actualizado' : 'Residente registrado' })
        setTimeout(() => setMsg(null), 4000)
      } else {
        const err = await res.json()
        setMsg({ type: 'err', text: 'Error: ' + (err.detail || JSON.stringify(err)) })
      }
    } catch { setMsg({ type: 'err', text: 'Error al guardar' }) }
  }

  async function handleDelete(id: number, nombre: string) {
    if (!confirm('¿Eliminar a ' + nombre + '? Se marcará como inactivo.')) return
    const res = await fetch('/api/personas/' + id, { method: 'DELETE' })
    if (res.ok) { fetchData(); setMsg({ type: 'ok', text: nombre + ' eliminado' }) }
  }

  async function handleAsignarAcceso() {
    if (!editingPersona) return
    if (!accesoForm.uid.trim()) { setAccesoMsg({ type: 'err', text: 'Ingresa el UID de la tarjeta' }); return }
    setGuardandoAcceso(true)
    try {
      const res = await fetch('/api/personas/' + editingPersona.id + '/acceso', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...accesoForm, tenant_id: tenantId }),
      })
      if (res.ok) {
        setAccesoMsg({ type: 'ok', text: 'Tarjeta asignada correctamente' })
        setAccesoForm({ uid: '', tipo_tarjeta: 'mifare_classic', puertas: [] })
        const r = await fetch('/api/personas/' + editingPersona.id + '/acceso?tenant_id=' + tenantId)
        if (r.ok) setTarjetasPersona(await r.json())
      } else {
        const err = await res.json()
        setAccesoMsg({ type: 'err', text: err.detail || 'Error al asignar' })
      }
    } catch { setAccesoMsg({ type: 'err', text: 'Error de conexión' }) }
    finally { setGuardandoAcceso(false) }
  }

  async function handleDesactivarTarjeta(tarjetaId: number) {
    if (!editingPersona) return
    if (!confirm('¿Desactivar esta tarjeta?')) return
    const res = await fetch('/api/personas/' + editingPersona.id + '/acceso/' + tarjetaId + '?tenant_id=' + tenantId, { method: 'DELETE' })
    if (res.ok) {
      setTarjetasPersona(prev => prev.map(t => t.id === tarjetaId ? { ...t, activa: false } : t))
    }
  }

  const personasFiltradas = personas.filter(p => {
    if (filtroRol !== 'todos' && !p.roles.includes(filtroRol)) return false
    if (busqueda) {
      const t = busqueda.toLowerCase()
      return p.nombre_completo.toLowerCase().includes(t) || p.rut.toLowerCase().includes(t) ||
        (p.email?.toLowerCase().includes(t)) || (p.datos_contacto?.departamento?.toLowerCase().includes(t))
    }
    return true
  })

  const countByRol = (rol: RolResidente) => personas.filter(p => p.roles.includes(rol)).length

  const TABS_MODAL = [
    { id: 'datos' as const, label: 'Datos', icon: '👤' },
    { id: 'acceso' as const, label: 'Acceso', icon: '🔑' },
    { id: 'historial' as const, label: 'Historial', icon: '📋' },
    { id: 'portal' as const, label: 'Portal App', icon: '📱' },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Residentes y Propietarios</h1>
          <p className="text-sm text-slate-500">Gestión de propietarios, residentes y arrendatarios</p>
        </div>
        <button onClick={openNew} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Nuevo Residente
        </button>
      </div>

      {msg && (
        <div className={'rounded-lg p-3 text-sm flex items-center justify-between ' + (msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200')}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="ml-2 text-lg leading-none opacity-60 hover:opacity-100">x</button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-100 p-4"><p className="text-xs text-slate-500">Total</p><p className="text-2xl font-bold text-slate-800 mt-1">{personas.length}</p></div>
        {ROLES_RESIDENTES.map(rol => (
          <div key={rol} className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-xs text-slate-500">{ROL_CONFIG[rol].label}s</p>
            <p className={'text-2xl font-bold mt-1 ' + (rol === 'propietario' ? 'text-violet-600' : rol === 'residente' ? 'text-indigo-600' : 'text-emerald-600')}>{countByRol(rol)}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-wrap">
          {(['todos', ...ROLES_RESIDENTES] as const).map(r => (
            <button key={r} onClick={() => setFiltroRol(r)}
              className={filtroRol === r
                ? (r === 'todos' ? 'px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-800 text-white' : 'px-3 py-1.5 rounded-lg text-sm font-medium ' + ROL_CONFIG[r].badge)
                : 'px-3 py-1.5 rounded-lg text-sm font-medium bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}>
              {r === 'todos' ? 'Todos (' + personas.length + ')' : ROL_CONFIG[r].label + 's (' + countByRol(r) + ')'}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre, RUT, depto..." className="w-full pl-9 pr-4 border border-slate-200 rounded-lg py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"/></div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>{['Residente', 'RUT', 'Rol', 'Depto / Torre', 'Contacto', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="text-slate-500 font-medium text-left px-4 py-3 text-xs uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {personasFiltradas.map(persona => (
                  <tr key={persona.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
                          {persona.nombre_completo.split(' ').map((n: string) => n[0]).slice(0,2).join('').toUpperCase()}
                        </div>
                        <p className="font-medium text-slate-800">{persona.nombre_completo}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{persona.rut}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {persona.roles.filter((r: string) => ROLES_RESIDENTES.includes(r as RolResidente)).map((rol: string) => (
                          <span key={rol} className={'px-2 py-0.5 rounded-full text-xs font-medium ' + (ROL_CONFIG[rol as RolResidente]?.badge || 'bg-slate-100 text-slate-600')}>
                            {ROL_CONFIG[rol as RolResidente]?.label || rol}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {persona.datos_contacto?.torre
                        ? ('Torre ' + persona.datos_contacto.torre + ' · Piso ' + persona.datos_contacto.piso + ' · Depto ' + persona.datos_contacto.departamento)
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      <p>{persona.telefono || '—'}</p>
                      <p className="text-slate-400">{persona.email || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + (ESTADO_CONFIG[persona.estado] || 'bg-slate-100 text-slate-500')}>{persona.estado}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(persona)} title="Editar" className="p-1.5 text-slate-400 hover:text-indigo-600 rounded transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button onClick={() => handleDelete(persona.id, persona.nombre_completo)} title="Eliminar" className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {personasFiltradas.length === 0 && (
            <div className="text-center py-12"><p className="text-4xl mb-2">👥</p><p className="text-slate-400 text-sm">No hay residentes registrados</p></div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-start p-5 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="font-semibold text-slate-800">{editingPersona ? 'Editar Residente' : 'Nuevo Residente'}</h3>
                {editingPersona && <p className="text-xs text-slate-400 mt-0.5">{editingPersona.nombre_completo}</p>}
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 text-xl leading-none">x</button>
            </div>

            <div className="flex border-b border-slate-100 shrink-0 px-5">
              {TABS_MODAL.map(tab => (
                <button key={tab.id} onClick={() => handleTabChange(tab.id)}
                  className={'flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors ' + (modalTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700')}>
                  <span>{tab.icon}</span> {tab.label}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1 p-5">
                            {modalTab === 'portal' && (
                <div className="space-y-4">
                  {!editingPersona ? (
                    <div className="text-center py-8 text-slate-400 text-sm">Guarda los datos del residente primero</div>
                  ) : loadingPortal ? (
                    <div className="flex justify-center py-8"><div className="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"/></div>
                  ) : (
                    <>
                      {portalCreado && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                          <p className="font-semibold text-emerald-800 mb-2">Cuenta lista para entregar</p>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-emerald-100">
                              <span className="text-slate-500 text-sm">RUT (usuario):</span>
                              <span className="font-mono font-bold text-slate-800">{portalCreado.rut}</span>
                            </div>
                            <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-emerald-100">
                              <span className="text-slate-500 text-sm">Contrasena:</span>
                              <span className="font-mono font-bold text-emerald-700 text-lg">{portalCreado.password}</span>
                            </div>
                          </div>
                          <p className="text-xs text-emerald-600 mt-2">Comparte esto con el residente. Entrara al portal con su RUT + esta contrasena.</p>
                        </div>
                      )}
                      {!portalCreado && portalCuenta && (
                        <div className={"rounded-xl p-4 border " + (portalCuenta.tiene_cuenta ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200")}>
                          {portalCuenta.tiene_cuenta ? (
                            <>
                              <p className="font-semibold text-emerald-800 flex items-center gap-2">
                                <span>&#10003;</span> Cuenta portal activa
                              </p>
                              <div className="mt-2 space-y-1 text-sm">
                                <p className="text-slate-600">Login: <span className="font-mono font-bold">{portalCuenta.rut}</span></p>
                                <p className="text-slate-500 text-xs">Ultimo acceso: {portalCuenta.ultimo_login ? new Date(portalCuenta.ultimo_login).toLocaleString("es-CL") : "nunca"}</p>
                              </div>
                            </>
                          ) : (
                            <p className="text-amber-800 font-medium">Sin cuenta - residente no puede acceder al portal/app</p>
                          )}
                        </div>
                      )}
                      {portalMsg && (
                        <div className={"rounded-lg p-3 text-sm " + (portalMsg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>{portalMsg.text}</div>
                      )}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                          {portalCuenta?.tiene_cuenta ? "Restablecer credenciales" : "Crear acceso portal/app"}
                        </p>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs text-slate-600 mb-1">RUT del residente (se usa como usuario)</label>
                            <input readOnly value={editingPersona?.rut || ""} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono bg-white text-slate-500"/>
                          </div>
                          <div>
                            <label className="block text-xs text-slate-600 mb-1">ID Departamento (ver en Estructura del Edificio)</label>
                            <input
                              type="number"
                              value={portalDeptoId}
                              onChange={e => setPortalDeptoId(e.target.value)}
                              placeholder="Ej: 3"
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-600 mb-1">Contrasena temporal *</label>
                            <input
                              value={portalPass}
                              onChange={e => setPortalPass(e.target.value)}
                              placeholder="Minimo 6 caracteres"
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <button
                            onClick={async () => {
                              if (!portalPass || portalPass.length < 6) { setPortalMsg({type:"err",text:"Contrasena minimo 6 caracteres"}); return }
                              setPortalMsg(null)
                              const r = await fetch("/api/personas/" + editingPersona!.id + "/portal-cuenta", {
                                method: "POST", headers: {"Content-Type":"application/json"},
                                body: JSON.stringify({tenant_id: tenantId, departamento_id: portalDeptoId ? Number(portalDeptoId) : null, password: portalPass})
                              })
                              const d = await r.json()
                              if (r.ok) { setPortalCreado({rut: d.rut, password: d.password}); setPortalCuenta({...portalCuenta, tiene_cuenta: true}) }
                              else { setPortalMsg({type:"err", text: d.detail || "Error al crear cuenta"}) }
                            }}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2 text-sm font-medium"
                          >
                            {portalCuenta?.tiene_cuenta ? "Restablecer Contrasena" : "Crear Cuenta Portal"}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
{modalTab === 'datos' && (
                <form onSubmit={handleSubmit} id="form-datos" className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Datos Personales</label>
                      <input required value={formData.nombre_completo} onChange={e => setFormData({...formData, nombre_completo: e.target.value})} placeholder="Nombre completo *" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-2"/>
                      <div className="grid grid-cols-2 gap-2">
                        <input required value={formData.rut} onChange={e => setFormData({...formData, rut: e.target.value})} placeholder="RUT * (12.345.678-9)" className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
                        <input value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} placeholder="Telefono" className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
                      </div>
                      <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="Email" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent mt-2"/>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Rol</label>
                      <div className="space-y-1.5">
                        {ROLES_RESIDENTES.map(rol => {
                          const conf = ROL_CONFIG[rol]
                          const sel = formData.roles.includes(rol)
                          return (
                            <button key={rol} type="button" onClick={() => toggleRole(rol)}
                              className={'w-full flex items-center gap-3 p-2.5 rounded-xl border-2 text-left transition-all ' + (sel ? conf.bg + ' ' + conf.border : 'border-slate-200 hover:border-slate-300')}>
                              <div className={'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ' + (sel ? conf.border : 'border-slate-300')}>
                                {sel && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-slate-700">{conf.label}</p>
                                <p className="text-xs text-slate-400">{conf.desc}</p>
                              </div>
                              {sel && <span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + conf.badge}>{conf.label}</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ubicacion</label>
                      <div className="grid grid-cols-3 gap-2">
                        <select value={formData.datos_contacto.condominio_id} onChange={e => setFormData({...formData, datos_contacto: {...formData.datos_contacto, condominio_id: e.target.value}})} className="border border-slate-200 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                          <option value="">Cond.</option>
                          {condominios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                        <input value={formData.datos_contacto.torre} onChange={e => setFormData({...formData, datos_contacto: {...formData.datos_contacto, torre: e.target.value}})} placeholder="Torre" className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
                        <input value={formData.datos_contacto.piso} onChange={e => setFormData({...formData, datos_contacto: {...formData.datos_contacto, piso: e.target.value}})} placeholder="Piso" className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
                        <input value={formData.datos_contacto.departamento} onChange={e => setFormData({...formData, datos_contacto: {...formData.datos_contacto, departamento: e.target.value}})} placeholder="Depto. N" className="col-span-3 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Contacto de Emergencia</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={formData.datos_contacto.contacto_emergencia} onChange={e => setFormData({...formData, datos_contacto: {...formData.datos_contacto, contacto_emergencia: e.target.value}})} placeholder="Nombre" className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
                        <input value={formData.datos_contacto.telefono_emergencia} onChange={e => setFormData({...formData, datos_contacto: {...formData.datos_contacto, telefono_emergencia: e.target.value}})} placeholder="Telefono" className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Estado</label>
                      <div className="flex gap-2">
                        {['activo', 'suspendido', 'inactivo'].map(e => (
                          <button key={e} type="button" onClick={() => setFormData({...formData, estado: e})}
                            className={'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ' + (formData.estado === e ? ESTADO_CONFIG[e] + ' border-current' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}>
                            {e.charAt(0).toUpperCase() + e.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </form>
              )}

              {modalTab === 'acceso' && (
                <div className="space-y-4">
                  {!editingPersona ? (
                    <div className="text-center py-8 bg-slate-50 rounded-xl">
                      <p className="text-3xl mb-2">💾</p>
                      <p className="text-slate-600 text-sm font-medium">Guarda primero los datos</p>
                      <p className="text-slate-400 text-xs mt-1">El acceso se puede asignar una vez que el residente este registrado</p>
                    </div>
                  ) : (
                    <>
                      {tarjetasPersona.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tarjetas Activas</p>
                          <div className="space-y-2">
                            {tarjetasPersona.map(t => (
                              <div key={t.id} className={'flex items-center justify-between p-3 rounded-xl border ' + (t.activa ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200 opacity-60')}>
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{t.activa ? '💳' : '❌'}</span>
                                  <div>
                                    <p className="text-sm font-mono font-semibold text-slate-800">{t.uid}</p>
                                    <p className="text-xs text-slate-500">{t.tipo_tarjeta} · {t.categoria}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (t.activa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>{t.activa ? 'Activa' : 'Inactiva'}</span>
                                  {t.activa && (
                                    <button onClick={() => handleDesactivarTarjeta(t.id)} className="p-1 text-red-400 hover:text-red-600 rounded">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Asignar Nueva Tarjeta</p>
                        {accesoMsg && (
                          <div className={'rounded-lg p-2 text-xs mb-3 ' + (accesoMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>{accesoMsg.text}</div>
                        )}
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs text-slate-600 mb-1">UID de la Tarjeta / Llavero *</label>
                            <input value={accesoForm.uid} onChange={e => setAccesoForm({...accesoForm, uid: e.target.value.toUpperCase()})}
                              placeholder="Ej: A3B4C5D6 (del lector RFID)"
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
                          </div>
                          <div>
                            <label className="block text-xs text-slate-600 mb-1">Tipo de Tarjeta</label>
                            <select value={accesoForm.tipo_tarjeta} onChange={e => setAccesoForm({...accesoForm, tipo_tarjeta: e.target.value})}
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                              {TIPO_TARJETA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>
                          {puertas.length > 0 && (
                            <div>
                              <label className="block text-xs text-slate-600 mb-1">Puertas con Acceso</label>
                              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                {puertas.map(p => (
                                  <label key={p.id} className={'flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ' + (accesoForm.puertas.includes(p.id) ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent')}>
                                    <input type="checkbox" checked={accesoForm.puertas.includes(p.id)} onChange={() => togglePuerta(p.id)} className="accent-indigo-600"/>
                                    <span className="text-sm text-slate-700">{p.nombre}</span>
                                    {p.descripcion && <span className="text-xs text-slate-400">— {p.descripcion}</span>}
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          <button onClick={handleAsignarAcceso} disabled={guardandoAcceso}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-60">
                            {guardandoAcceso ? 'Asignando...' : 'Asignar Tarjeta de Acceso'}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {modalTab === 'historial' && (
                <div>
                  {!editingPersona ? (
                    <div className="text-center py-8 text-slate-400 text-sm">Guarda primero para ver el historial</div>
                  ) : loadingHistorial ? (
                    <div className="flex justify-center py-8"><div className="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"/></div>
                  ) : historial.length === 0 ? (
                    <div className="text-center py-8"><p className="text-3xl mb-2">📋</p><p className="text-slate-400 text-sm">Sin eventos registrados aun</p></div>
                  ) : (
                    <div className="space-y-2">
                      {historial.map(ev => (
                        <div key={ev.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-lg shrink-0 mt-0.5">{ACCION_ICON[ev.accion] || ACCION_ICON.default}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700">{ev.descripcion}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{fmtDate(ev.fecha)}</p>
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500 shrink-0">{ev.modulo}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {modalTab === 'datos' && (
              <div className="flex gap-3 p-5 border-t border-slate-100 shrink-0">
                <button type="button" onClick={closeModal} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50">Cancelar</button>
                <button type="submit" form="form-datos" className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm hover:bg-indigo-700 font-medium">
                  {editingPersona ? 'Guardar Cambios' : 'Registrar Residente'}
                </button>
              </div>
            )}
            {modalTab !== 'datos' && (
              <div className="flex gap-3 p-5 border-t border-slate-100 shrink-0">
                <button type="button" onClick={closeModal} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50">Cerrar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
