'use client'
import { useState, useEffect } from 'react'
import { useSession } from '@/hooks/useSession'
import ModalSueldo from './components/ModalSueldo'
import ModalAdelanto from './components/ModalAdelanto'
import ModalEvaluacion from './components/ModalEvaluacion'

interface PersonalActivo {
  id: number
  nombre: string
  nombre_completo: string
  rut: string
  roles: string[]
  asistencias_mes: number
  adelantos_pendientes: number
  evaluacion_promedio: number | null
}

interface Resumen {
  mes: number
  anio: number
  total_sueldos: number
  total_adelantos: number
  total_asistencias: number
  tardanzas: number
  ausencias: number
  puntualidad_porcentaje: number
}

interface PersonaStaff {
  id: number
  nombre_completo: string
  rut: string
  telefono: string
  email: string
  roles: string[]
  estado: string
  datos_contacto?: any
}

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

const STAFF_ROLES = ['administrador', 'sub_administrador', 'conserje', 'guardia', 'aseo', 'mantencion', 'jardinero']

const ROLES_ADMIN = [
  { id: 'administrador', label: 'Administrador/a', desc: 'Gestion del condominio', badge: 'bg-purple-100 text-purple-700', bg: 'bg-purple-50', border: 'border-purple-300', grupo: 'Administracion' },
  { id: 'sub_administrador', label: 'Sub-Administrador', desc: 'Apoyo administrativo', badge: 'bg-purple-50 text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', grupo: 'Administracion' },
  { id: 'conserje', label: 'Conserje', desc: 'Control de acceso y atencion', badge: 'bg-blue-100 text-blue-700', bg: 'bg-blue-50', border: 'border-blue-300', grupo: 'Porteria' },
  { id: 'guardia', label: 'Guardia de Seguridad', desc: 'Vigilancia y seguridad', badge: 'bg-red-100 text-red-700', bg: 'bg-red-50', border: 'border-red-300', grupo: 'Porteria' },
  { id: 'aseo', label: 'Personal de Aseo', desc: 'Limpieza de areas comunes', badge: 'bg-teal-100 text-teal-700', bg: 'bg-teal-50', border: 'border-teal-300', grupo: 'Servicios' },
  { id: 'mantencion', label: 'Mantenimiento', desc: 'Reparaciones e instalaciones', badge: 'bg-amber-100 text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300', grupo: 'Servicios' },
  { id: 'jardinero', label: 'Jardinero/a', desc: 'Areas verdes', badge: 'bg-emerald-100 text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300', grupo: 'Servicios' },
] as const

const GRUPOS_ROLES = ['Administracion', 'Porteria', 'Servicios'] as const

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

export default function PersonalPage() {
  const { tenantId } = useSession()
  const [personal, setPersonal] = useState<PersonalActivo[]>([])
  const [staffList, setStaffList] = useState<PersonaStaff[]>([])
  const [puertas, setPuertas] = useState<Puerta[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [vistaActual, setVistaActual] = useState<'dashboard' | 'sueldos' | 'turnos' | 'asistencias' | 'adelantos' | 'evaluaciones'>('dashboard')
  const [showModalSueldo, setShowModalSueldo] = useState(false)
  const [showModalAdelanto, setShowModalAdelanto] = useState(false)
  const [showModalEvaluacion, setShowModalEvaluacion] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState<PersonaStaff | null>(null)
  const [modalTab, setModalTab] = useState<'datos' | 'acceso' | 'historial'>('datos')
  const [msgStaff, setMsgStaff] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [formStaff, setFormStaff] = useState({
    nombre_completo: '', rut: '', telefono: '', email: '',
    rol: 'conserje', turno: 'dia', estado: 'activo',
  })

  // Acceso state
  const [tarjetasPersona, setTarjetasPersona] = useState<TarjetaRFID[]>([])
  const [accesoForm, setAccesoForm] = useState({ uid: '', tipo_tarjeta: 'mifare_classic', puertas: [] as number[] })
  const [guardandoAcceso, setGuardandoAcceso] = useState(false)
  const [accesoMsg, setAccesoMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Historial state
  const [historial, setHistorial] = useState<HistorialEvento[]>([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)

  useEffect(() => {
    fetchRRHH()
    if (tenantId) { fetchStaff(); fetchPuertas() }
  }, [tenantId])

  async function fetchRRHH() {
    try {
      const hoy = new Date()
      const [personalRes, resumenRes] = await Promise.all([
        fetch('/api/personal/reportes/personal-activo'),
        fetch('/api/personal/reportes/resumen-mensual?mes=' + (hoy.getMonth() + 1) + '&anio=' + hoy.getFullYear()),
      ])
      if (personalRes.ok) {
        const data = await personalRes.json()
        setPersonal(data.map((p: any) => ({ ...p, nombre_completo: p.nombre_completo || p.nombre })))
      }
      if (resumenRes.ok) setResumen(await resumenRes.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchStaff() {
    if (!tenantId) return
    try {
      const res = await fetch('/api/personas?tenant_id=' + tenantId + '&limit=200')
      if (res.ok) {
        const all: PersonaStaff[] = await res.json()
        setStaffList(all.filter(p => p.roles.some(r => STAFF_ROLES.includes(r))))
      }
    } catch {}
  }

  async function fetchPuertas() {
    if (!tenantId) return
    try {
      const res = await fetch('/api/condominios/puertas?tenant_id=' + tenantId)
      if (res.ok) {
        const data = await res.json()
        setPuertas(Array.isArray(data) ? data : [])
      }
    } catch {}
  }

  function openNew() {
    setFormStaff({ nombre_completo: '', rut: '', telefono: '', email: '', rol: 'conserje', turno: 'dia', estado: 'activo' })
    setEditingStaff(null)
    setTarjetasPersona([])
    setHistorial([])
    setAccesoForm({ uid: '', tipo_tarjeta: 'mifare_classic', puertas: [] })
    setAccesoMsg(null)
    setModalTab('datos')
    setShowModal(true)
  }

  function openEdit(staff: PersonaStaff) {
    setFormStaff({
      nombre_completo: staff.nombre_completo, rut: staff.rut,
      telefono: staff.telefono || '', email: staff.email || '',
      rol: staff.roles.find(r => STAFF_ROLES.includes(r)) || 'conserje',
      turno: staff.datos_contacto?.turno || 'dia',
      estado: staff.estado,
    })
    setEditingStaff(staff)
    setTarjetasPersona([])
    setHistorial([])
    setAccesoForm({ uid: '', tipo_tarjeta: 'mifare_classic', puertas: [] })
    setAccesoMsg(null)
    setModalTab('datos')
    setShowModal(true)
  }

  function closeModal() { setShowModal(false); setEditingStaff(null) }

  async function handleTabChange(tab: 'datos' | 'acceso' | 'historial') {
    setModalTab(tab)
    if (!editingStaff) return
    if (tab === 'acceso' && tarjetasPersona.length === 0) {
      const r = await fetch('/api/personas/' + editingStaff.id + '/acceso?tenant_id=' + tenantId)
      if (r.ok) setTarjetasPersona(await r.json())
    }
    if (tab === 'historial' && historial.length === 0) {
      setLoadingHistorial(true)
      const r = await fetch('/api/personas/' + editingStaff.id + '/historial?tenant_id=' + tenantId)
      if (r.ok) setHistorial(await r.json())
      setLoadingHistorial(false)
    }
  }

  function togglePuerta(id: number) {
    setAccesoForm(prev => ({
      ...prev,
      puertas: prev.puertas.includes(id) ? prev.puertas.filter(p => p !== id) : [...prev.puertas, id],
    }))
  }

  async function handleSubmitStaff(e: React.FormEvent) {
    e.preventDefault()
    try {
      const url = editingStaff ? '/api/personas/' + editingStaff.id : '/api/personas'
      const method = editingStaff ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_completo: formStaff.nombre_completo,
          rut: formStaff.rut,
          telefono: formStaff.telefono,
          email: formStaff.email,
          roles: [formStaff.rol],
          estado: formStaff.estado,
          tenant_id: tenantId,
          datos_contacto: { turno: formStaff.turno },
        }),
      })
      if (res.ok) {
        const saved = await res.json()
        if (!editingStaff) setEditingStaff(saved)
        closeModal()
        fetchStaff()
        fetchRRHH()
        setMsgStaff({ type: 'ok', text: editingStaff ? 'Personal actualizado' : 'Personal registrado correctamente' })
        setTimeout(() => setMsgStaff(null), 4000)
      } else {
        const err = await res.json()
        setMsgStaff({ type: 'err', text: 'Error: ' + (err.detail || JSON.stringify(err)) })
      }
    } catch {
      setMsgStaff({ type: 'err', text: 'Error al guardar' })
    }
  }

  async function handleDeleteStaff(id: number, nombre: string) {
    if (!confirm('¿Eliminar a ' + nombre + ' del directorio de personal?')) return
    const res = await fetch('/api/personas/' + id, { method: 'DELETE' })
    if (res.ok) { fetchStaff(); setMsgStaff({ type: 'ok', text: 'Personal eliminado' }) }
  }

  async function handleAsignarAcceso() {
    if (!editingStaff) return
    if (!accesoForm.uid.trim()) { setAccesoMsg({ type: 'err', text: 'Ingresa el UID de la tarjeta' }); return }
    setGuardandoAcceso(true)
    try {
      const res = await fetch('/api/personas/' + editingStaff.id + '/acceso', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...accesoForm, tenant_id: tenantId }),
      })
      if (res.ok) {
        setAccesoMsg({ type: 'ok', text: 'Tarjeta asignada correctamente' })
        setAccesoForm({ uid: '', tipo_tarjeta: 'mifare_classic', puertas: [] })
        const r = await fetch('/api/personas/' + editingStaff.id + '/acceso?tenant_id=' + tenantId)
        if (r.ok) setTarjetasPersona(await r.json())
      } else {
        const err = await res.json()
        setAccesoMsg({ type: 'err', text: err.detail || 'Error al asignar' })
      }
    } catch { setAccesoMsg({ type: 'err', text: 'Error de conexion' }) }
    finally { setGuardandoAcceso(false) }
  }

  async function handleDesactivarTarjeta(tarjetaId: number) {
    if (!editingStaff) return
    if (!confirm('¿Desactivar esta tarjeta?')) return
    const res = await fetch('/api/personas/' + editingStaff.id + '/acceso/' + tarjetaId + '?tenant_id=' + tenantId, { method: 'DELETE' })
    if (res.ok) {
      setTarjetasPersona(prev => prev.map(t => t.id === tarjetaId ? { ...t, activa: false } : t))
    }
  }

  function getRolConfig(rol: string) {
    return ROLES_ADMIN.find(r => r.id === rol) || { label: rol, badge: 'bg-slate-100 text-slate-600', desc: '', bg: 'bg-slate-50', border: 'border-slate-200', grupo: 'Servicios' as const }
  }

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  const TABS_RRHH = [
    { id: 'dashboard', label: 'Dashboard RRHH' },
    { id: 'sueldos', label: 'Sueldos' },
    { id: 'turnos', label: 'Turnos' },
    { id: 'asistencias', label: 'Asistencias' },
    { id: 'adelantos', label: 'Adelantos' },
    { id: 'evaluaciones', label: 'Evaluaciones' },
  ]

  const TABS_MODAL = [
    { id: 'datos' as const, label: 'Datos', icon: '👤' },
    { id: 'acceso' as const, label: 'Acceso', icon: '🔑' },
    { id: 'historial' as const, label: 'Historial', icon: '📋' },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-8">

      {/* SECTION 1: Directorio de Personal */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Personal del Condominio</h1>
            <p className="text-sm text-slate-500">Administradores, conserjes, aseo, mantencion y seguridad</p>
          </div>
          <button onClick={openNew} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Agregar Personal
          </button>
        </div>

        {msgStaff && (
          <div className={'rounded-lg p-3 text-sm flex items-center justify-between mb-4 ' + (msgStaff.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200')}>
            <span>{msgStaff.text}</span>
            <button onClick={() => setMsgStaff(null)} className="text-lg leading-none opacity-60 hover:opacity-100">x</button>
          </div>
        )}

        {GRUPOS_ROLES.map(grupo => {
          const roles = ROLES_ADMIN.filter(r => r.grupo === grupo).map(r => r.id)
          const members = staffList.filter(p => p.roles.some(r => roles.includes(r as any)))
          if (members.length === 0) return null
          return (
            <div key={grupo} className="mb-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">{grupo}</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {members.map(staff => {
                  const rolPrincipal = staff.roles.find(r => ROLES_ADMIN.some(ra => ra.id === r)) || staff.roles[0]
                  const conf = getRolConfig(rolPrincipal)
                  return (
                    <div key={staff.id} className="bg-white rounded-xl border border-slate-100 p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-sm shrink-0">
                            {staff.nombre_completo.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">{staff.nombre_completo}</p>
                            <p className="text-xs text-slate-400 font-mono">{staff.rut}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => openEdit(staff)} className="p-1 text-slate-300 hover:text-indigo-500 rounded">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          </button>
                          <button onClick={() => handleDeleteStaff(staff.id, staff.nombre_completo)} className="p-1 text-slate-300 hover:text-red-400 rounded">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + conf.badge}>{conf.label}</span>
                        <span className={'px-2 py-0.5 rounded-full text-xs ' + (staff.estado === 'activo' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500')}>{staff.estado}</span>
                      </div>
                      {(staff.telefono || staff.email) && (
                        <div className="mt-2 text-xs text-slate-400 space-y-0.5">
                          {staff.telefono && <p>📞 {staff.telefono}</p>}
                          {staff.email && <p>✉️ {staff.email}</p>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {staffList.length === 0 && !loading && (
          <div className="text-center py-10 bg-white rounded-xl border border-slate-100">
            <p className="text-4xl mb-2">👷</p>
            <p className="text-slate-400 text-sm">No hay personal registrado</p>
            <p className="text-slate-300 text-xs mt-1">Agrega el primer miembro del equipo con el boton de arriba</p>
          </div>
        )}
      </div>

      {/* SECTION 2: RRHH */}
      <div className="border-t border-slate-100 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Gestion RRHH</h2>
            <p className="text-sm text-slate-500">Turnos, sueldos, adelantos y evaluaciones del personal activo</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.open('/api/personal/exportar/pdf', '_blank')} className="border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5 text-sm hover:bg-slate-50">PDF</button>
            <button onClick={() => window.open('/api/personal/exportar/excel', '_blank')} className="border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5 text-sm hover:bg-slate-50">Excel</button>
          </div>
        </div>

        <div className="overflow-x-auto mb-4">
          <div className="flex gap-2 min-w-max">
            {TABS_RRHH.map(tab => (
              <button key={tab.id} onClick={() => setVistaActual(tab.id as any)}
                className={vistaActual === tab.id ? 'px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white whitespace-nowrap' : 'px-4 py-2 rounded-lg text-sm font-medium bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 whitespace-nowrap'}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8"><div className="w-7 h-7 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : vistaActual === 'dashboard' && (
          <div className="space-y-4">
            {resumen && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">Total sueldos {resumen.mes ? MESES[resumen.mes - 1] : ''}</p>
                  <p className="text-xl font-bold text-slate-800 mt-1">${resumen.total_sueldos?.toLocaleString('es-CL') || 0}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">Adelantos pendientes</p>
                  <p className="text-xl font-bold text-amber-500 mt-1">${resumen.total_adelantos?.toLocaleString('es-CL') || 0}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">Tardanzas mes</p>
                  <p className="text-xl font-bold text-red-500 mt-1">{resumen.tardanzas || 0}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 p-4">
                  <p className="text-xs text-slate-500">% Puntualidad</p>
                  <p className="text-xl font-bold text-emerald-500 mt-1">{resumen.puntualidad_porcentaje?.toFixed(0) || 0}%</p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">Personal activo en RRHH ({personal.length})</h3>
                <p className="text-xs text-slate-400">Solo aparece personal con registros de sueldo/turno</p>
              </div>
              {personal.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No hay personal con registros RRHH aun. Agrega turnos o sueldos para verlos aqui.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Nombre', 'RUT', 'Asistencias mes', 'Adelantos', 'Evaluacion', ''].map(h => (
                        <th key={h} className="text-slate-500 font-medium text-left px-4 py-2 text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {personal.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{p.nombre_completo || p.nombre}</td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">{p.rut}</td>
                        <td className="px-4 py-3 text-slate-600">{p.asistencias_mes}</td>
                        <td className="px-4 py-3">
                          {p.adelantos_pendientes > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">{p.adelantos_pendientes} pendiente(s)</span>
                          ) : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {p.evaluacion_promedio !== null ? (
                            <span className="text-amber-500 font-medium">{'★'.repeat(Math.round(p.evaluacion_promedio || 0))} {p.evaluacion_promedio?.toFixed(1)}</span>
                          ) : <span className="text-slate-300 text-xs">Sin eval.</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => setShowModalSueldo(true)} className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-50 text-slate-600">Sueldo</button>
                            <button onClick={() => setShowModalAdelanto(true)} className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-50 text-slate-600">Adelanto</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      <ModalSueldo show={showModalSueldo} personal={personal} onClose={() => setShowModalSueldo(false)} onSuccess={() => { setShowModalSueldo(false); fetchRRHH() }} />
      <ModalAdelanto show={showModalAdelanto} personal={personal} onClose={() => setShowModalAdelanto(false)} onSuccess={() => { setShowModalAdelanto(false); fetchRRHH() }} />
      <ModalEvaluacion show={showModalEvaluacion} personal={personal} onClose={() => setShowModalEvaluacion(false)} onSuccess={() => { setShowModalEvaluacion(false); fetchRRHH() }} />

      {/* Staff Modal (3-tab: Datos / Acceso / Historial) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-start p-5 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="font-semibold text-slate-800">{editingStaff ? 'Editar Personal' : 'Agregar Personal'}</h3>
                {editingStaff && <p className="text-xs text-slate-400 mt-0.5">{editingStaff.nombre_completo}</p>}
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
              {/* TAB: DATOS */}
              {modalTab === 'datos' && (
                <form onSubmit={handleSubmitStaff} id="form-staff" className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Datos Personales</label>
                      <input required value={formStaff.nombre_completo} onChange={e => setFormStaff({...formStaff, nombre_completo: e.target.value})} placeholder="Nombre completo *" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-2"/>
                      <div className="grid grid-cols-2 gap-2">
                        <input required value={formStaff.rut} onChange={e => setFormStaff({...formStaff, rut: e.target.value})} placeholder="RUT * (12.345.678-9)" className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
                        <input value={formStaff.telefono} onChange={e => setFormStaff({...formStaff, telefono: e.target.value})} placeholder="Telefono" className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
                      </div>
                      <input type="email" value={formStaff.email} onChange={e => setFormStaff({...formStaff, email: e.target.value})} placeholder="Email" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent mt-2"/>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Cargo</label>
                      {GRUPOS_ROLES.map(grupo => (
                        <div key={grupo} className="mb-3">
                          <p className="text-xs text-slate-500 font-medium mb-1.5">{grupo}</p>
                          <div className="grid grid-cols-2 gap-2">
                            {ROLES_ADMIN.filter(r => r.grupo === grupo).map(r => (
                              <button key={r.id} type="button" onClick={() => setFormStaff({...formStaff, rol: r.id})}
                                className={'flex items-start gap-2 p-2.5 rounded-xl border-2 text-left transition-all ' + (formStaff.rol === r.id ? r.badge + ' border-current' : 'border-slate-200 hover:border-slate-300')}>
                                <div>
                                  <p className="text-xs font-semibold">{r.label}</p>
                                  <p className="text-xs text-slate-400 mt-0.5">{r.desc}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Turno</label>
                      <div className="flex gap-2">
                        {[{ id: 'dia', label: '☀️ Dia' }, { id: 'noche', label: '🌙 Noche' }, { id: 'mixto', label: '🔄 Mixto' }].map(t => (
                          <button key={t.id} type="button" onClick={() => setFormStaff({...formStaff, turno: t.id})}
                            className={'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ' + (formStaff.turno === t.id ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Estado</label>
                      <div className="flex gap-2">
                        {[{ id: 'activo', label: '✅ Activo' }, { id: 'inactivo', label: '⏸️ Inactivo' }].map(est => (
                          <button key={est.id} type="button" onClick={() => setFormStaff({...formStaff, estado: est.id})}
                            className={'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ' + (formStaff.estado === est.id
                              ? (est.id === 'activo' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-300')
                              : 'border-slate-200 text-slate-500 hover:bg-slate-50')}>
                            {est.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </form>
              )}

              {/* TAB: ACCESO */}
              {modalTab === 'acceso' && (
                <div className="space-y-4">
                  {!editingStaff ? (
                    <div className="text-center py-8 bg-slate-50 rounded-xl">
                      <p className="text-3xl mb-2">💾</p>
                      <p className="text-slate-600 text-sm font-medium">Guarda primero los datos</p>
                      <p className="text-slate-400 text-xs mt-1">El acceso se puede asignar una vez que el personal este registrado</p>
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

              {/* TAB: HISTORIAL */}
              {modalTab === 'historial' && (
                <div>
                  {!editingStaff ? (
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
                <button type="submit" form="form-staff" className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm hover:bg-indigo-700 font-medium">
                  {editingStaff ? 'Guardar Cambios' : 'Agregar Personal'}
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
