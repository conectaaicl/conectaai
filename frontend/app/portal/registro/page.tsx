'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Eye, EyeOff } from 'lucide-react'

interface Depto { id: number; numero: string; torre?: string; condominio?: string }

export default function PortalRegistro() {
  const router = useRouter()
  const [rut, setRut] = useState('')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [deptoId, setDeptoId] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const [deptos, setDeptos] = useState<Depto[]>([])

  useEffect(() => {
    fetch('/api/portal/auth/departamentos-publico?tenant_id=1')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (Array.isArray(data)) setDeptos(data)
        else if (data?.items) setDeptos(data.items)
      })
      .catch(() => {})
  }, [])

  const validate = () => {
    const errs: Record<string,string> = {}
    if (!rut.trim()) errs.rut = 'El RUT es requerido'
    if (!nombre.trim()) errs.nombre = 'El nombre es requerido'
    if (!deptoId) errs.depto = 'Seleccione su departamento'
    if (!password) errs.password = 'La contrasena es requerida'
    else if (password.length < 6) errs.password = 'Minimo 6 caracteres'
    if (password !== confirm) errs.confirm = 'Las contrasenas no coinciden'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/portal/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rut, nombre_completo: nombre,
          email: email || undefined,
          telefono: telefono || undefined,
          departamento_id: parseInt(deptoId),
          password, tenant_id: 1
        })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || 'Error al registrarse'); setLoading(false); return }
      localStorage.setItem('portal_token', data.token)
      localStorage.setItem('portal_residente', JSON.stringify(data.residente))
      router.push('/portal/dashboard')
    } catch { setError('Error de conexion'); setLoading(false) }
  }

  const fe = fieldErrors
  const inputClass = (err?: string) =>
    `w-full border rounded-xl px-4 py-3 text-sm bg-white text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent ${err ? 'border-red-400' : 'border-slate-300'}`

  return (
    <div className="min-h-screen bg-brand-900 flex flex-col items-center justify-center p-4 py-10">
      <div className="mb-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4">
          <Building2 size={24} className="text-white" strokeWidth={1.75} />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">ConectaAI</h1>
        <p className="text-brand-200 mt-1 text-sm">Portal de residentes</p>
      </div>
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Crear cuenta</h2>
        {error && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-3 text-sm mb-4">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">RUT *</label>
            <input value={rut} onChange={e => setRut(e.target.value)} placeholder="12.345.678-9"
              className={inputClass(fe.rut)}/>
            {fe.rut && <p className="text-red-600 text-xs mt-1">{fe.rut}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre completo *</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Juan Perez"
              className={inputClass(fe.nombre)}/>
            {fe.nombre && <p className="text-red-600 text-xs mt-1">{fe.nombre}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Departamento *</label>
            <select value={deptoId} onChange={e => setDeptoId(e.target.value)}
              className={inputClass(fe.depto)}>
              <option value="">Seleccione su departamento</option>
              {deptos.map(d => (
                <option key={d.id} value={d.id}>
                  {d.condominio ? d.condominio + ' - ' : ''}Depto {d.numero}{d.torre ? ' (Torre ' + d.torre + ')' : ''}
                </option>
              ))}
            </select>
            {fe.depto && <p className="text-red-600 text-xs mt-1">{fe.depto}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email (opcional)</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com"
              className={inputClass()}/>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Telefono (opcional)</label>
            <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="+56 9 1234 5678"
              className={inputClass()}/>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Contrasena *</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                className={inputClass(fe.password) + ' pr-11'}/>
              <button type="button" onClick={() => setShowPw(!showPw)}
                aria-label={showPw ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fe.password && <p className="text-red-600 text-xs mt-1">{fe.password}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirmar contrasena *</label>
            <input type={showPw ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
              className={inputClass(fe.confirm)}/>
            {fe.confirm && <p className="text-red-600 text-xs mt-1">{fe.confirm}</p>}
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-brand-700 text-white py-3 rounded-xl font-semibold hover:bg-brand-800 disabled:opacity-50 transition-colors">
            {loading ? 'Registrando...' : 'Crear cuenta'}
          </button>
        </form>
        <p className="text-center text-sm text-slate-500 mt-6">
          Ya tienes cuenta?{' '}
          <a href="/portal/login" className="text-brand-700 font-semibold hover:underline">Inicia sesion</a>
        </p>
      </div>
    </div>
  )
}
