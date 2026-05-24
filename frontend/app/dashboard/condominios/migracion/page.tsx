'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from '@/hooks/useSession'
import Link from 'next/link'

type Paso = 0 | 1 | 2 | 3 | 4
type Tipo = 'residentes' | 'vehiculos' | 'gastos_comunes'
type Fuente = 'excel' | 'pdf'

interface FilaValidada { fila_num:number; datos:Record<string,string>; errores:string[]; advertencias:string[]; estado:'ok'|'advertencia'|'error' }
interface Historial { id:number; tipo:string; archivo_nombre:string; total_filas:number; importados:number; errores:number; estado:string; usuario:string; created_at:string }

const TIPO_LABELS: Record<string,string> = { residentes:'Residentes', vehiculos:'Vehiculos', gastos_comunes:'Gastos Comunes' }
const CAMPO_LABELS: Record<string,string> = {
  nombre_completo:'Nombre Completo', depto_numero:'Depto/Unidad', rut:'RUT', email:'Email', telefono:'Telefono',
  tipo:'Tipo', patente:'Patente', marca:'Marca', modelo:'Modelo', color:'Color',
  monto:'Monto', periodo:'Periodo', estado:'Estado', ignorar:'— Ignorar —',
}
const CAMPOS_POR_TIPO: Record<string, string[]> = {
  residentes:['nombre_completo','depto_numero','rut','email','telefono','tipo','ignorar'],
  vehiculos:['patente','depto_numero','marca','modelo','color','ignorar'],
  gastos_comunes:['depto_numero','monto','periodo','estado','ignorar'],
}

function StepBar({ paso }: { paso: Paso }) {
  const pasos = ['Inicio','Cargar','Mapear','Validar','Listo']
  return (
    <div className="flex items-center justify-center gap-0 mb-8 overflow-x-auto">
      {pasos.map((p,i)=>(
        <div key={i} className="flex items-center">
          <div className={`flex flex-col items-center ${i>0?'ml-1':''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${i<=paso?'bg-indigo-600 text-white':'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>{i+1}</div>
            <span className={`text-xs mt-1 whitespace-nowrap ${i===paso?'text-indigo-600 font-medium':'text-slate-400'}`}>{p}</span>
          </div>
          {i<pasos.length-1&&<div className={`h-0.5 w-8 mx-1 mt-[-14px] transition-all ${i<paso?'bg-indigo-600':'bg-slate-200 dark:bg-slate-700'}`} />}
        </div>
      ))}
    </div>
  )
}

export default function MigracionPage() {
  const { user } = useSession()
  const [paso, setPaso] = useState<Paso>(0)
  const [fuente, setFuente] = useState<Fuente>('excel')
  const [tipo, setTipo] = useState<Tipo>('residentes')
  const [archivo, setArchivo] = useState<File|null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [historial, setHistorial] = useState<Historial[]>([])
  const [analisisData, setAnalisisData] = useState<any>(null)
  const [mapeo, setMapeo] = useState<Record<string,string>>({})
  const [validacion, setValidacion] = useState<any>(null)
  const [filtroValidacion, setFiltroValidacion] = useState<'todos'|'ok'|'advertencia'|'error'>('todos')
  const [pdfData, setPdfData] = useState<any>(null)
  const [resultado, setResultado] = useState<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const tid = typeof window !== 'undefined' ? localStorage.getItem('current_condominio_id') : null

  const loadHistorial = useCallback(async () => {
    if (!tid) return
    const res = await fetch('/api/migracion/historial?tenant_id='+tid+'&limit=10')
    if (res.ok) setHistorial(await res.json())
  }, [tid])

  useEffect(() => { loadHistorial() }, [loadHistorial])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) setArchivo(f)
  }

  async function analizarArchivo() {
    if (!archivo || !tid) return
    setLoading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file', archivo)
      fd.append('tenant_id', tid)
      fd.append('tipo', tipo)
      if (fuente === 'excel') {
        const res = await fetch('/api/migracion/analizar-excel', { method:'POST', body:fd })
        if (!res.ok) { setError((await res.json()).detail||'Error al analizar'); return }
        const data = await res.json()
        setAnalisisData(data)
        setMapeo(data.sugerencias_mapeo || {})
        setPaso(2)
      } else {
        const res = await fetch('/api/migracion/analizar-pdf', { method:'POST', body:fd })
        if (!res.ok) { setError((await res.json()).detail||'Error al analizar PDF'); return }
        const data = await res.json()
        setPdfData(data); setPaso(2)
      }
    } finally { setLoading(false) }
  }

  async function validarDatos() {
    if (!tid || !analisisData) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/migracion/validar', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ tenant_id:parseInt(tid), tipo, mapeo, datos: analisisData.datos })
      })
      if (!res.ok) { setError((await res.json()).detail||'Error al validar'); return }
      setValidacion(await res.json()); setPaso(3)
    } finally { setLoading(false) }
  }

  async function importar() {
    if (!tid || !validacion) return
    setLoading(true); setError('')
    try {
      const filasValidas = validacion.filas.filter((f: FilaValidada) => f.estado !== 'error')
      const res = await fetch('/api/migracion/importar', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ tenant_id:parseInt(tid), tipo, filas:filasValidas, usuario:user?.nombre_completo||'admin' })
      })
      if (!res.ok) { setError((await res.json()).detail||'Error al importar'); return }
      setResultado(await res.json()); setPaso(4); loadHistorial()
    } finally { setLoading(false) }
  }

  async function importarPdf() {
    if (!tid || !pdfData) return
    setLoading(true); setError('')
    try {
      const residentes = (pdfData.datos_detectados?.residentes||[]).map((r:any)=>({
        datos:{ nombre_completo:r.nombre||'', depto_numero:r.depto||'', rut:r.rut||'', email:r.email||'', telefono:r.telefono||'', tipo:r.tipo||'residente' }
      }))
      const res = await fetch('/api/migracion/importar', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ tenant_id:parseInt(tid), tipo:'residentes', filas:residentes, usuario:user?.nombre_completo||'admin' })
      })
      if (!res.ok) { setError((await res.json()).detail||'Error'); return }
      setResultado(await res.json()); setPaso(4); loadHistorial()
    } finally { setLoading(false) }
  }

  function descargarPlantilla(t: string) {
    window.open('/api/migracion/plantilla/'+t, '_blank')
  }

  const filasFiltradasValidacion = validacion?.filas?.filter((f:FilaValidada)=>
    filtroValidacion==='todos' || f.estado===filtroValidacion
  ) || []

  // STEP 0 — Landing
  if (paso === 0) return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Motor de Migracion</h1>
        <p className="text-slate-500 text-sm mt-1">Importa tus datos existentes en minutos con mapeo inteligente y validacion automatica</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon:'📊', title:'Excel / CSV', desc:'Sube tu planilla y mapeamos las columnas automaticamente con IA', fuente:'excel' as Fuente, action:()=>{ setFuente('excel'); setPaso(1) } },
          { icon:'📄', title:'PDF Inteligente', desc:'Extraemos datos con OCR + Claude de cualquier PDF de condominios', fuente:'pdf' as Fuente, action:()=>{ setFuente('pdf'); setPaso(1) } },
          { icon:'⬇️', title:'Descargar Plantilla', desc:'Descarga nuestra plantilla Excel pre-configurada lista para llenar', fuente:null, action:null },
        ].map((card,i)=>(
          <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 hover:border-indigo-300 transition-all cursor-pointer group"
            onClick={card.action||undefined}>
            <div className="text-3xl mb-3">{card.icon}</div>
            <h3 className="font-semibold text-slate-800 dark:text-white mb-1 group-hover:text-indigo-600 transition-colors">{card.title}</h3>
            <p className="text-sm text-slate-500 mb-4">{card.desc}</p>
            {card.action ? (
              <button onClick={e=>{ e.stopPropagation(); card.action!() }} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">Comenzar</button>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {['residentes','vehiculos','gastos_comunes'].map(t=>(
                  <button key={t} onClick={e=>{ e.stopPropagation(); descargarPlantilla(t) }} className="py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded text-xs">{TIPO_LABELS[t]}</button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {historial.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="font-semibold text-slate-800 dark:text-white mb-4">Historial de Importaciones</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                {['Fecha','Tipo','Archivo','Importados','Errores','Estado'].map(h=><th key={h} className="pb-2 font-medium text-slate-500 pr-4">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {historial.map(h=>(
                  <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="py-2 pr-4 text-xs text-slate-500">{h.created_at.slice(0,16).replace('T',' ')}</td>
                    <td className="py-2 pr-4"><span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs">{TIPO_LABELS[h.tipo]||h.tipo}</span></td>
                    <td className="py-2 pr-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">{h.archivo_nombre||'-'}</td>
                    <td className="py-2 pr-4 font-semibold text-green-600">{h.importados}</td>
                    <td className="py-2 pr-4 text-red-500">{h.errores}</td>
                    <td className="py-2"><span className={'px-2 py-0.5 rounded-full text-xs '+(h.estado==='completado'?'bg-green-100 text-green-700':'bg-yellow-100 text-yellow-700')}>{h.estado}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )

  // STEP 1 — Upload
  if (paso === 1) return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <StepBar paso={1} />
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
        <h2 className="text-lg font-bold dark:text-white">Cargar archivo {fuente==='excel'?'Excel / CSV':'PDF / Imagen'}</h2>

        <div className="grid grid-cols-3 gap-3">
          {(['residentes','vehiculos','gastos_comunes'] as Tipo[]).map(t=>(
            <button key={t} onClick={()=>setTipo(t)} className={`py-2 rounded-lg text-sm font-medium border transition-all ${tipo===t?'bg-indigo-600 text-white border-indigo-600':'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-indigo-300'}`}>{TIPO_LABELS[t]}</button>
          ))}
        </div>

        <div
          onDrop={onDrop}
          onDragOver={e=>e.preventDefault()}
          onClick={()=>fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${archivo?'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/20':'border-slate-300 dark:border-slate-600 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
        >
          <input ref={fileRef} type="file" className="hidden"
            accept={fuente==='excel'?'.xlsx,.xls,.csv':'.pdf,.png,.jpg,.jpeg'}
            onChange={e=>{ if(e.target.files?.[0]) setArchivo(e.target.files[0]) }} />
          {archivo ? (
            <div>
              <div className="text-3xl mb-2">✅</div>
              <div className="font-semibold text-indigo-600">{archivo.name}</div>
              <div className="text-xs text-slate-500 mt-1">{(archivo.size/1024).toFixed(1)} KB — click para cambiar</div>
            </div>
          ) : (
            <div>
              <div className="text-4xl mb-3">{fuente==='excel'?'📊':'📄'}</div>
              <div className="font-medium text-slate-700 dark:text-slate-200">Arrastra tu archivo aqui o click para seleccionar</div>
              <div className="text-xs text-slate-400 mt-2">{fuente==='excel'?'.xlsx, .xls, .csv':'.pdf, .png, .jpg'}</div>
            </div>
          )}
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}

        <div className="flex justify-between">
          <button onClick={()=>{ setPaso(0); setArchivo(null); setError('') }} className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-600 dark:text-white rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">Volver</button>
          <button onClick={analizarArchivo} disabled={!archivo||loading} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm disabled:opacity-50">
            {loading?'Analizando...':'Analizar archivo →'}
          </button>
        </div>
      </div>
    </div>
  )

  // STEP 2 — Mapeo (Excel) or PDF preview
  if (paso === 2) {
    if (fuente === 'pdf' && pdfData) return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <StepBar paso={2} />
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold dark:text-white">Datos extraidos por IA</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${pdfData.confianza==='alta'?'bg-green-100 text-green-700':pdfData.confianza==='media'?'bg-yellow-100 text-yellow-700':'bg-red-100 text-red-700'}`}>
              Confianza {pdfData.confianza} · {pdfData.total_detectados} registros
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium text-slate-700 dark:text-slate-300 mb-2">Residentes ({pdfData.datos_detectados?.residentes?.length||0})</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(pdfData.datos_detectados?.residentes||[]).map((r:any,i:number)=>(
                  <div key={i} className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3 text-sm">
                    <div className="font-medium dark:text-white">{r.nombre||'Sin nombre'}</div>
                    <div className="text-slate-500 text-xs">Depto: {r.depto||'-'} · {r.email||''}</div>
                  </div>
                ))}
                {!(pdfData.datos_detectados?.residentes?.length) && <div className="text-slate-400 text-sm py-4">No se detectaron residentes</div>}
              </div>
            </div>
            <div>
              <h3 className="font-medium text-slate-700 dark:text-slate-300 mb-2">Vehiculos ({pdfData.datos_detectados?.vehiculos?.length||0})</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(pdfData.datos_detectados?.vehiculos||[]).map((v:any,i:number)=>(
                  <div key={i} className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3 text-sm">
                    <div className="font-medium dark:text-white">{v.patente||'Sin patente'}</div>
                    <div className="text-slate-500 text-xs">{v.marca||''} {v.modelo||''} · Depto: {v.depto||'-'}</div>
                  </div>
                ))}
                {!(pdfData.datos_detectados?.vehiculos?.length) && <div className="text-slate-400 text-sm py-4">No se detectaron vehiculos</div>}
              </div>
            </div>
          </div>
          {pdfData.texto_ocr && (
            <details className="mt-4">
              <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-700">Ver texto OCR extraido</summary>
              <pre className="mt-2 bg-slate-100 dark:bg-slate-700 rounded p-3 text-xs text-slate-600 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-40">{pdfData.texto_ocr}</pre>
            </details>
          )}
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mt-4">{error}</div>}
          <div className="flex justify-between mt-6">
            <button onClick={()=>setPaso(1)} className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-600 dark:text-white rounded-lg">Volver</button>
            <button onClick={importarPdf} disabled={loading||pdfData.total_detectados===0} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm disabled:opacity-50">
              {loading?'Importando...':'Importar registros →'}
            </button>
          </div>
        </div>
      </div>
    )

    // Excel column mapping
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <StepBar paso={2} />
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-bold dark:text-white">Mapear columnas</h2>
            <span className="text-sm text-slate-500">{analisisData?.total_filas} filas detectadas</span>
          </div>
          <p className="text-sm text-slate-500 mb-4">Asigna cada columna de tu Excel al campo correspondiente en ConectaAI. Los campos marcados con * son obligatorios.</p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm mb-6">
              <thead><tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                <th className="pb-2 font-medium text-slate-500 pr-4 w-48">Tu columna</th>
                <th className="pb-2 font-medium text-slate-500 pr-4">Ejemplo de dato</th>
                <th className="pb-2 font-medium text-slate-500">Campo ConectaAI</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {(analisisData?.columnas||[]).map((col: string) => {
                  const preview = analisisData?.preview?.[0]?.[col] || ''
                  return (
                    <tr key={col}>
                      <td className="py-2 pr-4 font-mono text-xs text-slate-700 dark:text-slate-300">{col}</td>
                      <td className="py-2 pr-4 text-slate-500 text-xs max-w-xs truncate">{String(preview).slice(0,40)||'(vacio)'}</td>
                      <td className="py-2">
                        <select
                          value={mapeo[col]||'ignorar'}
                          onChange={e=>setMapeo({...mapeo,[col]:e.target.value})}
                          className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm dark:bg-slate-700 dark:text-white w-56"
                        >
                          {(CAMPOS_POR_TIPO[tipo]||[]).map(c=>(
                            <option key={c} value={c}>{CAMPO_LABELS[c]||c}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 mb-4">
            <div className="text-xs font-medium text-slate-500 mb-2">Vista previa (primeras 3 filas con tu mapeo):</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr>{Object.entries(mapeo).filter(([,v])=>v!=='ignorar').map(([k,v])=><th key={k} className="text-left font-medium text-slate-500 pr-3 pb-1">{CAMPO_LABELS[v]||v}</th>)}</tr></thead>
                <tbody>{(analisisData?.preview||[]).slice(0,3).map((row:any,i:number)=>(
                  <tr key={i}>{Object.entries(mapeo).filter(([,v])=>v!=='ignorar').map(([col])=><td key={col} className="pr-3 py-0.5 text-slate-600 dark:text-slate-300">{String(row[col]||'').slice(0,30)}</td>)}</tr>
                ))}</tbody>
              </table>
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}

          <div className="flex justify-between">
            <button onClick={()=>setPaso(1)} className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-600 dark:text-white rounded-lg">Volver</button>
            <button onClick={validarDatos} disabled={loading} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm disabled:opacity-50">
              {loading?'Validando...':'Validar datos →'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // STEP 3 — Validation sandbox
  if (paso === 3 && validacion) return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <StepBar paso={3} />
      <div className="grid grid-cols-4 gap-4">
        {[
          { label:'Total', val:validacion.total, color:'text-slate-700 dark:text-white', bg:'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
          { label:'Listos', val:validacion.validos, color:'text-green-600', bg:'bg-green-50 border-green-200' },
          { label:'Advertencias', val:validacion.con_advertencias, color:'text-yellow-600', bg:'bg-yellow-50 border-yellow-200' },
          { label:'Errores criticos', val:validacion.errores_criticos, color:'text-red-600', bg:'bg-red-50 border-red-200' },
        ].map(s=>(
          <div key={s.label} className={`${s.bg} border rounded-xl p-4 text-center`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex flex-wrap gap-2 items-center mb-4">
          <span className="text-sm font-medium dark:text-white mr-2">Filtrar:</span>
          {(['todos','ok','advertencia','error'] as const).map(f=>(
            <button key={f} onClick={()=>setFiltroValidacion(f)} className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${filtroValidacion===f?'bg-indigo-600 text-white':'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
              {f==='todos'?'Todos':f==='ok'?'Listos':f==='advertencia'?'Advertencias':'Errores'}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-500">{filasFiltradasValidacion.length} mostradas</span>
        </div>

        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-slate-800">
              <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                <th className="pb-2 font-medium text-slate-500 pr-3 w-12">#</th>
                <th className="pb-2 font-medium text-slate-500 pr-3">Datos</th>
                <th className="pb-2 font-medium text-slate-500 pr-3">Estado</th>
                <th className="pb-2 font-medium text-slate-500">Problemas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filasFiltradasValidacion.map((f: FilaValidada) => (
                <tr key={f.fila_num} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="py-2 pr-3 text-slate-400 text-xs">{f.fila_num}</td>
                  <td className="py-2 pr-3">
                    <div className="text-xs text-slate-700 dark:text-slate-200">
                      {Object.entries(f.datos).slice(0,3).map(([k,v])=>(
                        <span key={k} className="mr-3"><span className="text-slate-400">{k}:</span> {String(v).slice(0,20)}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${f.estado==='ok'?'bg-green-100 text-green-700':f.estado==='advertencia'?'bg-yellow-100 text-yellow-700':'bg-red-100 text-red-700'}`}>
                      {f.estado==='ok'?'Listo':f.estado==='advertencia'?'Advertencia':'Error'}
                    </span>
                  </td>
                  <td className="py-2 text-xs space-y-0.5">
                    {f.errores.map((e,i)=><div key={i} className="text-red-600">✕ {e}</div>)}
                    {f.advertencias.map((a,i)=><div key={i} className="text-yellow-600">⚠ {a}</div>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-300">
        Los registros con <strong>errores criticos</strong> seran omitidos. Se importaran <strong className="text-green-600">{validacion.validos + validacion.con_advertencias} registros</strong>.
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}

      <div className="flex justify-between">
        <button onClick={()=>setPaso(2)} className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-600 dark:text-white rounded-lg">Volver</button>
        <button onClick={importar} disabled={loading||(validacion.validos+validacion.con_advertencias)===0}
          className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm disabled:opacity-50">
          {loading?'Importando...':'Importar '+(validacion.validos+validacion.con_advertencias)+' registros →'}
        </button>
      </div>
    </div>
  )

  // STEP 4 — Result
  if (paso === 4 && resultado) return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <StepBar paso={4} />
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-green-200 dark:border-green-800 p-8 text-center">
        <div className="text-6xl mb-4 animate-bounce">✅</div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Importacion completada</h2>
        <p className="text-slate-500 text-sm mb-6">Los datos han sido importados exitosamente al sistema</p>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 rounded-xl p-4">
            <div className="text-3xl font-bold text-green-600">{resultado.importados}</div>
            <div className="text-xs text-green-600 mt-1">Importados</div>
          </div>
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-xl p-4">
            <div className="text-3xl font-bold text-red-500">{resultado.errores}</div>
            <div className="text-xs text-red-500 mt-1">Con errores</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-4">
            <div className="text-3xl font-bold text-slate-700 dark:text-white">{resultado.importados+resultado.errores}</div>
            <div className="text-xs text-slate-500 mt-1">Total procesados</div>
          </div>
        </div>
        {resultado.errores > 0 && resultado.detalles_errores?.length > 0 && (
          <details className="text-left mb-4">
            <summary className="text-sm text-red-500 cursor-pointer">Ver {resultado.errores} errores de importacion</summary>
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {resultado.detalles_errores.slice(0,20).map((e:any,i:number)=>(
                <div key={i} className="text-xs bg-red-50 dark:bg-red-950/20 text-red-600 rounded p-2">{e.error}</div>
              ))}
            </div>
          </details>
        )}
        <div className="flex gap-3 justify-center">
          <button onClick={()=>{ setPaso(0); setArchivo(null); setAnalisisData(null); setMapeo({}); setValidacion(null); setResultado(null) }}
            className="px-5 py-2 border border-slate-200 dark:border-slate-600 dark:text-white rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
            Nueva Importacion
          </button>
          {tipo==='residentes' && (
            <Link href="/dashboard/condominios/personas" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">
              Ver Residentes →
            </Link>
          )}
        </div>
      </div>
    </div>
  )

  return <div className="p-6"><div className="text-slate-400">Cargando...</div></div>
}
