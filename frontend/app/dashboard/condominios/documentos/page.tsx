'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from '@/hooks/useSession'

const CATEGORIAS = ['reglamento','acta','contrato','seguro','financiero','otro']
const catColor: Record<string,string> = {
  reglamento: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  acta: 'bg-violet-50 text-violet-700 border border-violet-200',
  contrato: 'bg-blue-50 text-blue-700 border border-blue-200',
  seguro: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  financiero: 'bg-amber-50 text-amber-700 border border-amber-200',
  otro: 'bg-slate-50 text-slate-600 border border-slate-200',
}
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function FileIcon({ url }: { url: string }) {
  const ext = (url||'').split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return (
    <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
    </div>
  )
  if (ext === 'doc' || ext === 'docx') return (
    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
      <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
    </div>
  )
  return (
    <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center shrink-0">
      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
    </div>
  )
}

function fmtBytes(b: number) {
  if (!b) return ''
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB'
  return (b/1048576).toFixed(1) + ' MB'
}

export default function DocumentosPage() {
  const { user } = useSession()
  const tenantId = (user as any)?.tenant_id || 1
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState<{type:'ok'|'err',text:string}|null>(null)
  const [form, setForm] = useState({ titulo:'', descripcion:'', categoria:'otro', visible_residentes:true })
  const [file, setFile] = useState<File|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = '?tenant_id=' + tenantId + (filterCat ? '&categoria=' + filterCat : '')
      const r = await fetch('/api/condominios/documentos' + qs)
      if (r.ok) setDocs(await r.json())
    } finally { setLoading(false) }
  }, [tenantId, filterCat])

  useEffect(() => { load() }, [load])

  const handleUpload = async () => {
    if (!form.titulo.trim()) { setMsg({type:'err',text:'El titulo es requerido'}); return }
    if (!file) { setMsg({type:'err',text:'Selecciona un archivo'}); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('tenant_id', String(tenantId))
      fd.append('titulo', form.titulo)
      fd.append('descripcion', form.descripcion)
      fd.append('categoria', form.categoria)
      fd.append('visible_residentes', String(form.visible_residentes))
      fd.append('file', file)
      const r = await fetch('/api/condominios/documentos/upload', { method: 'POST', body: fd })
      if (r.ok) {
        setMsg({type:'ok',text:'Documento subido'})
        setShowModal(false)
        setForm({titulo:'',descripcion:'',categoria:'otro',visible_residentes:true})
        setFile(null)
        load()
      } else {
        const e = await r.json().catch(()=>({}))
        setMsg({type:'err',text:'Error: ' + (e.detail || 'No se pudo subir')})
      }
    } finally { setUploading(false) }
  }

  const handleToggleVisible = async (id: number, visible: boolean) => {
    await fetch('/api/condominios/documentos/' + id, {
      method: 'PUT', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ visible_residentes: visible })
    })
    load()
  }

  const handleDelete = async (id: number) => {
    await fetch('/api/condominios/documentos/' + id, { method: 'DELETE' })
    load()
  }

  const filtered = docs.filter(d =>
    (d.titulo||'').toLowerCase().includes(search.toLowerCase()) ||
    (d.descripcion||'').toLowerCase().includes(search.toLowerCase())
  )

  const catCounts = CATEGORIAS.reduce((acc, c) => {
    acc[c] = docs.filter(d => d.categoria === c).length
    return acc
  }, {} as Record<string,number>)

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Documentos</h1>
          <p className="text-slate-500 text-sm mt-1">Repositorio de documentos del condominio</p>
        </div>
        <button onClick={()=>setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
          Subir documento
        </button>
      </div>

      {msg && (
        <div className={'rounded-lg p-3 text-sm flex items-center justify-between ' + (msg.type==='ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200')}>
          <span>{msg.text}</span>
          <button onClick={()=>setMsg(null)} className="ml-2 opacity-60 hover:opacity-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button onClick={()=>setFilterCat('')} className={'px-3 py-1.5 rounded-lg text-xs font-medium border ' + (!filterCat ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}>
          Todos ({docs.length})
        </button>
        {CATEGORIAS.map(c => catCounts[c] > 0 && (
          <button key={c} onClick={()=>setFilterCat(filterCat===c?'':c)} className={'px-3 py-1.5 rounded-lg text-xs font-medium border ' + (filterCat===c ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}>
            {capitalize(c)} ({catCounts[c]})
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar documentos..." className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
      </div>

      {loading ? (
        <div className="text-center py-12"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"/></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-100">
          <svg className="w-10 h-10 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <p className="text-slate-400 text-sm">No hay documentos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(d => (
            <div key={d.id} className="bg-white rounded-xl border border-slate-100 p-4 flex flex-col gap-3 hover:border-indigo-200 transition-colors">
              <div className="flex items-start gap-3">
                <FileIcon url={d.archivo_url}/>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{d.titulo}</p>
                  {d.descripcion && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{d.descripcion}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={'text-xs px-2 py-0.5 rounded-full border ' + (catColor[d.categoria] || catColor.otro)}>{capitalize(d.categoria)}</span>
                {d.visible_residentes && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">Visible</span>
                )}
                {d.tamano_bytes && <span className="text-xs text-slate-400">{fmtBytes(d.tamano_bytes)}</span>}
              </div>
              <p className="text-xs text-slate-400">{d.creado_en ? new Date(d.creado_en).toLocaleDateString('es-CL') : '—'}</p>
              <div className="flex items-center gap-2 pt-1 border-t border-slate-50">
                <a href={d.archivo_url} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-medium transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  Descargar
                </a>
                <button
                  onClick={() => handleToggleVisible(d.id, !d.visible_residentes)}
                  className={'p-1.5 rounded-lg text-xs transition-colors ' + (d.visible_residentes ? 'text-teal-600 hover:bg-teal-50' : 'text-slate-400 hover:bg-slate-50')}
                  title={d.visible_residentes ? 'Ocultar a residentes' : 'Mostrar a residentes'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d.visible_residentes ? 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' : 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21'}/></svg>
                </button>
                <button onClick={() => handleDelete(d.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">Subir Documento</h2>
              <button onClick={()=>setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Titulo *</label>
                <input value={form.titulo} onChange={e=>setForm(p=>({...p,titulo:e.target.value}))} placeholder="Nombre del documento" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripcion</label>
                <textarea value={form.descripcion} onChange={e=>setForm(p=>({...p,descripcion:e.target.value}))} rows={2} placeholder="Descripcion opcional..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                <select value={form.categoria} onChange={e=>setForm(p=>({...p,categoria:e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                  {CATEGORIAS.map(c => <option key={c} value={c}>{capitalize(c)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Archivo *</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                >
                  {file ? (
                    <div>
                      <p className="text-sm font-medium text-indigo-600">{file.name}</p>
                      <p className="text-xs text-slate-400">{fmtBytes(file.size)}</p>
                    </div>
                  ) : (
                    <div>
                      <svg className="w-8 h-8 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                      <p className="text-sm text-slate-500">Haz clic para seleccionar</p>
                      <p className="text-xs text-slate-400">PDF, DOC, XLS, y mas</p>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)}/>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="visible" checked={form.visible_residentes} onChange={e=>setForm(p=>({...p,visible_residentes:e.target.checked}))} className="rounded"/>
                <label htmlFor="visible" className="text-sm text-slate-700">Visible para residentes</label>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-slate-100">
              <button onClick={()=>setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm">Cancelar</button>
              <button onClick={handleUpload} disabled={uploading} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-60">
                {uploading ? 'Subiendo...' : 'Subir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
