'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'

interface CheckItem { id:number; orden:number; descripcion:string; zona?:string; obligatorio:boolean; resp_estado?:string; resp_notas?:string }
interface Ronda { id:number; conserje_nombre:string; turno?:string; estado:string; fecha_inicio:string; fecha_fin?:string; items_total:number; items_completados:number; plantilla_nombre?:string }
interface Plantilla { id:number; nombre:string; turno:string; total_items:number }

const ESTADO_ITEM_COLORS: Record<string,string> = { ok:'bg-green-100 text-green-700', problema:'bg-red-100 text-red-700', na:'bg-slate-100 text-slate-500' }

export default function ChecklistPage() {
  const { user } = useSession()
  const [tab, setTab] = useState<'rondas'|'plantillas'>('rondas')
  const [rondas, setRondas] = useState<Ronda[]>([])
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [rondaActiva, setRondaActiva] = useState<{ id:number; items:CheckItem[] }|null>(null)
  const [loading, setLoading] = useState(true)
  const [showNewRonda, setShowNewRonda] = useState(false)
  const [showNewPlantilla, setShowNewPlantilla] = useState(false)
  const [newRondaForm, setNewRondaForm] = useState({ plantilla_id:'', turno:'manana' })
  const [newPlantillaForm, setNewPlantillaForm] = useState({ nombre:'', turno:'cualquiera', items:'' })
  const [submitting, setSubmitting] = useState(false)
  const tid = typeof window !== 'undefined' ? localStorage.getItem('current_condominio_id') : null

  const loadRondas = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    try {
      const res = await fetch('/api/checklist/rondas?tenant_id='+tid+'&limit=30')
      if (res.ok) setRondas(await res.json())
    } finally { setLoading(false) }
  }, [tid])

  const loadPlantillas = useCallback(async () => {
    if (!tid) return
    const res = await fetch('/api/checklist/plantillas?tenant_id='+tid)
    if (res.ok) setPlantillas(await res.json())
  }, [tid])

  useEffect(() => { loadPlantillas(); loadRondas() }, [loadPlantillas, loadRondas])

  async function iniciarRonda() {
    if (!tid || !newRondaForm.plantilla_id) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/checklist/rondas', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ tenant_id:parseInt(tid), plantilla_id:parseInt(newRondaForm.plantilla_id), conserje_nombre:user?.nombre_completo||'Conserje', turno:newRondaForm.turno })
      })
      if (res.ok) {
        const data = await res.json()
        setRondaActiva({ id:data.id, items:data.items.map((i:any)=>({...i, resp_estado:undefined, resp_notas:undefined})) })
        setShowNewRonda(false); loadRondas()
      }
    } finally { setSubmitting(false) }
  }

  async function responderItem(rondaId:number, itemId:number, estado:string, notas?:string) {
    await fetch('/api/checklist/rondas/'+rondaId+'/item/'+itemId, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ estado, notas:notas||null, foto_url:null })
    })
    if (rondaActiva) {
      setRondaActiva({ ...rondaActiva, items: rondaActiva.items.map(i=>i.id===itemId?{...i,resp_estado:estado,resp_notas:notas||undefined}:i) })
    }
  }

  async function finalizarRonda(rondaId:number) {
    await fetch('/api/checklist/rondas/'+rondaId+'/finalizar', { method:'PATCH' })
    setRondaActiva(null); loadRondas()
  }

  async function crearPlantilla() {
    if (!tid || !newPlantillaForm.nombre) return
    setSubmitting(true)
    try {
      const itemLines = newPlantillaForm.items.split('\n').filter(l=>l.trim())
      const items = itemLines.map((desc,i)=>({ orden:i+1, descripcion:desc.trim(), obligatorio:true }))
      const res = await fetch('/api/checklist/plantillas', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ tenant_id:parseInt(tid), nombre:newPlantillaForm.nombre, turno:newPlantillaForm.turno, items })
      })
      if (res.ok) { setShowNewPlantilla(false); loadPlantillas() }
    } finally { setSubmitting(false) }
  }

  const completadas = rondaActiva?.items.filter(i=>i.resp_estado).length||0
  const total = rondaActiva?.items.length||0
  const porcentaje = total>0?Math.round((completadas/total)*100):0

  if (rondaActiva) {
    return (
      <div className="p-6 space-y-4 max-w-2xl mx-auto">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold dark:text-white">Ronda en Curso</h1>
          <div className="flex gap-2">
            <span className="text-sm text-slate-500">{completadas}/{total} items</span>
            <button onClick={()=>setRondaActiva(null)} className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400">Ocultar</button>
          </div>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2"><div className="bg-indigo-500 h-2 rounded-full transition-all" style={{width:porcentaje+'%'}} /></div>

        <div className="space-y-3">
          {rondaActiva.items.map(item=>(
            <div key={item.id} className={'rounded-xl border p-4 '+(item.resp_estado?'bg-slate-50 dark:bg-slate-800/50 border-slate-200':'bg-white dark:bg-slate-800 border-slate-300')}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-sm font-medium dark:text-white">{item.orden}. {item.descripcion}</span>
                  {item.zona&&<span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{item.zona}</span>}
                </div>
                {item.resp_estado&&<span className={'px-2 py-0.5 rounded-full text-xs font-medium '+(ESTADO_ITEM_COLORS[item.resp_estado]||'')}>{item.resp_estado}</span>}
              </div>
              {!item.resp_estado && (
                <div className="flex gap-2 mt-2">
                  <button onClick={()=>responderItem(rondaActiva.id,item.id,'ok')} className="px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 text-sm rounded-lg font-medium">OK</button>
                  <button onClick={()=>{ const n=prompt('Describe el problema:'); responderItem(rondaActiva.id,item.id,'problema',n||undefined) }} className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-sm rounded-lg font-medium">Problema</button>
                  <button onClick={()=>responderItem(rondaActiva.id,item.id,'na')} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm rounded-lg font-medium">N/A</button>
                </div>
              )}
              {item.resp_notas&&<p className="text-xs text-slate-500 mt-1">{item.resp_notas}</p>}
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4">
          <button onClick={()=>finalizarRonda(rondaActiva.id)} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium">Finalizar Ronda</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-slate-800 dark:text-white">Checklist de Rondas</h1><p className="text-slate-500 text-sm">Control de rondas del conserje</p></div>
        <button onClick={()=>setShowNewRonda(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm">+ Iniciar Ronda</button>
      </div>

      <div className="flex gap-2">
        <button onClick={()=>setTab('rondas')} className={'px-4 py-1.5 rounded-lg text-sm font-medium '+(tab==='rondas'?'bg-indigo-600 text-white':'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700')}>Historial</button>
        <button onClick={()=>setTab('plantillas')} className={'px-4 py-1.5 rounded-lg text-sm font-medium '+(tab==='plantillas'?'bg-indigo-600 text-white':'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700')}>Plantillas</button>
      </div>

      {tab==='rondas' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          {loading ? <div className="text-center py-12 text-slate-400">Cargando...</div>
          : rondas.length===0 ? <div className="text-center py-12 text-slate-400">Sin rondas registradas</div>
          : <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 text-left">{['Fecha','Conserje','Plantilla','Turno','Progreso','Estado'].map(h=><th key={h} className="pb-2 font-medium text-slate-500 pr-4">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {rondas.map(r=>(
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="py-2 pr-4 text-slate-600 dark:text-slate-300 text-xs">{r.fecha_inicio.slice(0,16).replace('T',' ')}</td>
                    <td className="py-2 pr-4 font-medium dark:text-white">{r.conserje_nombre}</td>
                    <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">{r.plantilla_nombre||'-'}</td>
                    <td className="py-2 pr-4 text-slate-500 capitalize">{r.turno||'-'}</td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-200 rounded-full h-1.5"><div className="bg-indigo-500 h-1.5 rounded-full" style={{width:r.items_total>0?Math.round((r.items_completados/r.items_total)*100)+'%':'0%'}} /></div>
                        <span className="text-xs text-slate-500">{r.items_completados}/{r.items_total}</span>
                      </div>
                    </td>
                    <td className="py-2"><span className={'px-2 py-0.5 rounded-full text-xs font-medium '+(r.estado==='completada'?'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700')}>{r.estado}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>}
        </div>
      )}

      {tab==='plantillas' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={()=>setShowNewPlantilla(true)} className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-medium text-sm">+ Nueva Plantilla</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plantillas.map(p=>(
              <div key={p.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="font-semibold dark:text-white mb-1">{p.nombre}</div>
                <div className="text-sm text-slate-500">{p.total_items} items · {p.turno}</div>
              </div>
            ))}
            {plantillas.length===0&&<div className="col-span-3 text-center py-12 text-slate-400">Sin plantillas. Crea una para comenzar.</div>}
          </div>
        </div>
      )}

      {showNewRonda && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4 dark:text-white">Iniciar Nueva Ronda</h2>
            <div className="space-y-4">
              <div><label className="text-sm font-medium dark:text-slate-300">Plantilla</label>
                <select value={newRondaForm.plantilla_id} onChange={e=>setNewRondaForm({...newRondaForm,plantilla_id:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-white">
                  <option value="">Selecciona plantilla...</option>
                  {plantillas.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select></div>
              <div><label className="text-sm font-medium dark:text-slate-300">Turno</label>
                <select value={newRondaForm.turno} onChange={e=>setNewRondaForm({...newRondaForm,turno:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-white">
                  <option value="manana">Manana</option><option value="tarde">Tarde</option><option value="noche">Noche</option>
                </select></div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={()=>setShowNewRonda(false)} className="px-4 py-2 text-sm rounded-lg border dark:border-slate-600 dark:text-white">Cancelar</button>
                <button onClick={iniciarRonda} disabled={submitting||!newRondaForm.plantilla_id} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50">{submitting?'Iniciando...':'Iniciar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNewPlantilla && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4 dark:text-white">Nueva Plantilla</h2>
            <div className="space-y-4">
              <div><label className="text-sm font-medium dark:text-slate-300">Nombre</label><input required value={newPlantillaForm.nombre} onChange={e=>setNewPlantillaForm({...newPlantillaForm,nombre:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-white" /></div>
              <div><label className="text-sm font-medium dark:text-slate-300">Turno</label>
                <select value={newPlantillaForm.turno} onChange={e=>setNewPlantillaForm({...newPlantillaForm,turno:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-white">
                  <option value="cualquiera">Cualquiera</option><option value="manana">Manana</option><option value="tarde">Tarde</option><option value="noche">Noche</option>
                </select></div>
              <div><label className="text-sm font-medium dark:text-slate-300">Items (uno por linea)</label><textarea rows={6} placeholder="Revisar puerta principal&#10;Verificar iluminacion pasillos&#10;Control de paquetes..." value={newPlantillaForm.items} onChange={e=>setNewPlantillaForm({...newPlantillaForm,items:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm dark:bg-slate-700 dark:text-white" /></div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={()=>setShowNewPlantilla(false)} className="px-4 py-2 text-sm rounded-lg border dark:border-slate-600 dark:text-white">Cancelar</button>
                <button onClick={crearPlantilla} disabled={submitting||!newPlantillaForm.nombre} className="px-4 py-2 text-sm rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-medium disabled:opacity-50">{submitting?'Creando...':'Crear'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
