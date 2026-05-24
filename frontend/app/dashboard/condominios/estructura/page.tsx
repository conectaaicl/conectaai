'use client'
import { useState, useEffect } from 'react'
import { useSession } from '@/hooks/useSession'

interface Condominio {
  id: number; nombre: string; direccion: string; comuna: string; region: string;
  ciudad?: string; tipo?: string; rut_condominio?: string; anno_construccion?: number;
  metros_totales?: number; telefono_contacto?: string; email_contacto?: string;
  website?: string; logo_url?: string; administrador_nombre?: string;
  administrador_rut?: string; empresa_administradora?: string;
  administrador_telefono?: string; administrador_email?: string; contrato_inicio?: string;
}
interface Torre { id: number; condominio_id: number; nombre: string; numero_pisos: number }
interface Resumen {
  condominio: Condominio;
  stats: { torres: number; pisos: number; departamentos: number; estacionamientos: number; bodegas: number; residentes_activos: number }
}

export default function EstructuraPage() {
  const { tenantId } = useSession()
  const [tab, setTab] = useState<'resumen'|'torres'|'condominios'>('resumen')
  const [condominios, setCondominios] = useState<Condominio[]>([])
  const [selectedCondominio, setSelectedCondominio] = useState<number|null>(null)
  const [resumen, setResumen] = useState<Resumen|null>(null)
  const [torres, setTorres] = useState<Torre[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingResumen, setLoadingResumen] = useState(false)
  const [msg, setMsg] = useState<{type:'ok'|'err';text:string}|null>(null)
  const [showModalCond, setShowModalCond] = useState(false)
  const [editingCond, setEditingCond] = useState<Condominio|null>(null)
  const [formCond, setFormCond] = useState<Partial<Condominio>>({nombre:'',direccion:'',comuna:'',region:'Metropolitana',ciudad:'Santiago',tipo:'edificio',rut_condominio:'',telefono_contacto:'',email_contacto:'',website:'',logo_url:'',empresa_administradora:'',administrador_nombre:'',administrador_rut:'',administrador_telefono:'',administrador_email:'',contrato_inicio:''})
  const [showModalTorre, setShowModalTorre] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [formTorre, setFormTorre] = useState({nombre:'',numero_pisos:1,condominio_id:0})

  useEffect(()=>{fetchCondominios()},[])
  useEffect(()=>{ if(selectedCondominio){fetchResumen(selectedCondominio);fetchTorres(selectedCondominio)} },[selectedCondominio])

  async function fetchCondominios(){
    try{const res=await fetch('/api/condominios?tenant_id='+tenantId);if(res.ok){const data=await res.json();setCondominios(data);if(data.length>=1)setSelectedCondominio(data[0].id)}}catch{}finally{setLoading(false)}
  }
  async function fetchResumen(id:number){
    setLoadingResumen(true)
    try{const res=await fetch('/api/condominios'+id+'/resumen?tenant_id='+tenantId);if(res.ok)setResumen(await res.json())}catch{}finally{setLoadingResumen(false)}
  }
  async function fetchTorres(id:number){
    try{const res=await fetch('/api/condominios'+id+'/torres');if(res.ok)setTorres(await res.json());else setTorres([])}catch{setTorres([])}
  }
  function openCreate(){setEditingCond(null);setFormCond({nombre:'',direccion:'',comuna:'',region:'Metropolitana',ciudad:'Santiago',tipo:'edificio',rut_condominio:'',telefono_contacto:'',email_contacto:'',website:'',logo_url:'',empresa_administradora:'',administrador_nombre:'',administrador_rut:'',administrador_telefono:'',administrador_email:'',contrato_inicio:''});setShowModalCond(true)}
  function openEdit(c:Condominio){setEditingCond(c);setFormCond({...c});setShowModalCond(true)}
  async function saveCond(e:React.FormEvent){
    e.preventDefault()
    try{
      const url=editingCond?'/api/condominios'+editingCond.id:'/api/condominios'
      const method=editingCond?'PUT':'POST'
      const payload=editingCond?{...formCond}:{...formCond,tenant_id:tenantId}
      const res=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
      if(res.ok){setShowModalCond(false);fetchCondominios();if(selectedCondominio)fetchResumen(selectedCondominio);setMsg({type:'ok',text:editingCond?'Condominio actualizado':'Condominio creado'});setTimeout(()=>setMsg(null),4000)}
      else{const err=await res.json();setMsg({type:'err',text:'Error: '+JSON.stringify(err)})}
    }catch{setMsg({type:'err',text:'Error al guardar'})}
  }
  async function deleteCond(id:number){
    if(!confirm('Eliminar condominio? Se eliminaran todas sus torres, pisos y departamentos.'))return
    try{const res=await fetch('/api/condominios'+id,{method:'DELETE'});if(res.ok){fetchCondominios();if(selectedCondominio===id){setSelectedCondominio(null);setResumen(null);setTorres([])};setMsg({type:'ok',text:'Condominio eliminado'});setTimeout(()=>setMsg(null),3000)}}catch{setMsg({type:'err',text:'Error al eliminar'})}
  }
  async function createTorre(e:React.FormEvent){
    e.preventDefault()
    const condId=formTorre.condominio_id||selectedCondominio
    if(!condId)return
    try{
      const res=await fetch('/api/condominios'+condId+'/torres',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:formTorre.nombre,numero_pisos:formTorre.numero_pisos})})
      if(res.ok){setShowModalTorre(false);if(selectedCondominio){fetchTorres(selectedCondominio);fetchResumen(selectedCondominio)};setFormTorre({nombre:'',numero_pisos:1,condominio_id:0});setMsg({type:'ok',text:'Torre creada con sus pisos'});setTimeout(()=>setMsg(null),3000)}
      else{const err=await res.json();setMsg({type:'err',text:'Error: '+JSON.stringify(err)})}
    }catch{setMsg({type:'err',text:'Error al crear torre'})}
  }
  async function uploadLogo(file: File) {
    if (!editingCond?.id) {
      const reader = new FileReader()
      reader.onload = (ev) => { if (ev.target?.result) setFormCond(prev => ({ ...prev, logo_url: ev.target!.result as string })) }
      reader.readAsDataURL(file)
      return
    }
    setUploadingLogo(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/api/condominios/' + editingCond.id + '/upload-logo', { method: 'POST', body: fd })
      if (r.ok) {
        const d = await r.json()
        setFormCond(prev => ({ ...prev, logo_url: d.url }))
        setMsg({ type: 'ok', text: 'Logo subido' })
        setTimeout(() => setMsg(null), 3000)
      }
    } finally { setUploadingLogo(false) }
  }
  async function deleteTorre(torreId:number){
    if(!confirm('Eliminar torre? Se eliminaran todos sus pisos y departamentos.'))return
    try{const res=await fetch('/api/condominios/torres/'+torreId,{method:'DELETE'});if(res.ok){if(selectedCondominio){fetchTorres(selectedCondominio);fetchResumen(selectedCondominio)};setMsg({type:'ok',text:'Torre eliminada'});setTimeout(()=>setMsg(null),3000)}}catch{setMsg({type:'err',text:'Error al eliminar torre'})}
  }
  const fc=(field:keyof Condominio)=>(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>setFormCond(prev=>({...prev,[field]:e.target.value}))
  const inp='w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
  const lbl='block text-xs font-medium text-slate-600 mb-1'
  const TLABELS:Record<string,string>={edificio:'Edificio',condominio:'Condominio',townhouse:'Townhouse',casa:'Casa'}
  const TCOLORS:Record<string,string>={edificio:'bg-indigo-100 text-indigo-700',condominio:'bg-emerald-100 text-emerald-700',townhouse:'bg-amber-100 text-amber-700',casa:'bg-rose-100 text-rose-700'}

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-slate-800">Estructura</h1><p className="text-sm text-slate-500">Condominios, torres, pisos y departamentos</p></div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Nuevo Condominio
          </button>
          <button onClick={()=>{setFormTorre({nombre:'',numero_pisos:1,condominio_id:selectedCondominio||0});setShowModalTorre(true)}} className="border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Nueva Torre
          </button>
        </div>
      </div>

      {msg&&<div className={'rounded-lg p-3 text-sm flex items-center justify-between '+(msg.type==='ok'?'bg-emerald-50 text-emerald-700 border border-emerald-200':'bg-red-50 text-red-700 border border-red-200')}><span>{msg.text}</span><button onClick={()=>setMsg(null)} className="ml-2 opacity-60 hover:opacity-100"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div>}

      <div className="flex gap-1 border-b border-slate-200">
        {(['resumen','torres','condominios'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} className={'px-4 py-2.5 text-sm font-medium transition-colors '+(tab===t?'text-indigo-600 border-b-2 border-indigo-600':'text-slate-500 hover:text-slate-700')}>
            {t==='resumen'?'Resumen':t==='torres'?'Torres y Pisos':'Condominios'}
          </button>
        ))}
      </div>

      {loading?<div className="text-center py-12"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" /></div>:(
        <>
          {tab==='resumen'&&(
            <div className="space-y-6">
              {condominios.length>1&&<div><label className={lbl}>Seleccionar condominio</label><select value={selectedCondominio||''} onChange={e=>setSelectedCondominio(Number(e.target.value))} className={inp+' max-w-xs'}>{condominios.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>}
              {condominios.length===0&&<div className="text-center py-16 bg-white rounded-xl border border-slate-100"><p className="text-slate-400 text-sm">No hay condominios registrados.</p><button onClick={openCreate} className="mt-3 text-indigo-600 text-sm hover:underline">Crear el primero</button></div>}
              {selectedCondominio&&loadingResumen&&<div className="text-center py-8"><div className="w-6 h-6 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" /></div>}
              {selectedCondominio&&!loadingResumen&&resumen&&(
                <>
                  <div className="bg-white rounded-xl border border-slate-100 p-6">
                    <div className="flex items-start justify-between mb-5">
                      <div className="flex items-center gap-4">
                        {resumen.condominio.logo_url
                          ?<img src={resumen.condominio.logo_url} alt="logo" className="w-16 h-16 rounded-xl object-cover border border-slate-100" />
                          :<div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center"><svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg></div>}
                        <div>
                          <h2 className="text-2xl font-bold text-slate-800">{resumen.condominio.nombre}</h2>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {resumen.condominio.tipo&&<span className={'px-2 py-0.5 rounded-full text-xs font-medium '+(TCOLORS[resumen.condominio.tipo]||'bg-slate-100 text-slate-600')}>{TLABELS[resumen.condominio.tipo]||resumen.condominio.tipo}</span>}
                            {resumen.condominio.rut_condominio&&<span className="text-xs text-slate-500">RUT: {resumen.condominio.rut_condominio}</span>}
                          </div>
                          <p className="text-sm text-slate-500 mt-1">{resumen.condominio.direccion}{resumen.condominio.ciudad?', '+resumen.condominio.ciudad:''}{resumen.condominio.region?' - '+resumen.condominio.region:''}</p>
                        </div>
                      </div>
                      <button onClick={()=>openEdit(resumen.condominio)} className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                      {resumen.condominio.anno_construccion?<div><p className="text-xs text-slate-400">Ano construccion</p><p className="font-medium text-slate-700">{resumen.condominio.anno_construccion}</p></div>:null}
                      {resumen.condominio.metros_totales?<div><p className="text-xs text-slate-400">Metros totales</p><p className="font-medium text-slate-700">{resumen.condominio.metros_totales.toLocaleString()} m2</p></div>:null}
                      {resumen.condominio.telefono_contacto?<div><p className="text-xs text-slate-400">Telefono</p><p className="font-medium text-slate-700">{resumen.condominio.telefono_contacto}</p></div>:null}
                      {resumen.condominio.email_contacto?<div><p className="text-xs text-slate-400">Email</p><p className="font-medium text-slate-700">{resumen.condominio.email_contacto}</p></div>:null}
                      {resumen.condominio.website?<div><p className="text-xs text-slate-400">Sitio web</p><a href={resumen.condominio.website} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">{resumen.condominio.website}</a></div>:null}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[{label:'Torres',value:resumen.stats.torres,color:'text-indigo-600'},{label:'Pisos',value:resumen.stats.pisos,color:'text-sky-600'},{label:'Departamentos',value:resumen.stats.departamentos,color:'text-emerald-600'},{label:'Residentes',value:resumen.stats.residentes_activos,color:'text-violet-600'},{label:'Estacionamientos',value:resumen.stats.estacionamientos,color:'text-amber-600'},{label:'Bodegas',value:resumen.stats.bodegas,color:'text-rose-600'}].map(s=>(
                      <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-4"><p className="text-xs text-slate-400">{s.label}</p><p className={'text-2xl font-bold mt-1 '+s.color}>{s.value}</p></div>
                    ))}
                  </div>

                  {(resumen.condominio.empresa_administradora||resumen.condominio.administrador_nombre)?(
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2"><svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg><h3 className="font-semibold text-slate-800">Empresa Administradora</h3></div>
                        <button onClick={()=>openEdit(resumen.condominio)} className="p-1.5 text-indigo-400 hover:text-indigo-700 rounded hover:bg-indigo-100"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                        {resumen.condominio.empresa_administradora?<div><p className="text-xs text-slate-400">Empresa</p><p className="font-medium text-slate-700">{resumen.condominio.empresa_administradora}</p></div>:null}
                        {resumen.condominio.administrador_nombre?<div><p className="text-xs text-slate-400">Administrador</p><p className="font-medium text-slate-700">{resumen.condominio.administrador_nombre}</p></div>:null}
                        {resumen.condominio.administrador_rut?<div><p className="text-xs text-slate-400">RUT</p><p className="font-medium text-slate-700">{resumen.condominio.administrador_rut}</p></div>:null}
                        {resumen.condominio.administrador_telefono?<div><p className="text-xs text-slate-400">Telefono</p><p className="font-medium text-slate-700">{resumen.condominio.administrador_telefono}</p></div>:null}
                        {resumen.condominio.administrador_email?<div><p className="text-xs text-slate-400">Email</p><p className="font-medium text-slate-700">{resumen.condominio.administrador_email}</p></div>:null}
                        {resumen.condominio.contrato_inicio?<div><p className="text-xs text-slate-400">Contrato desde</p><p className="font-medium text-slate-700">{String(resumen.condominio.contrato_inicio).split('T')[0]}</p></div>:null}
                      </div>
                    </div>
                  ):(
                    <div className="bg-indigo-50 border border-dashed border-indigo-200 rounded-xl p-5 flex items-center gap-3 text-sm text-indigo-500">
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      <span>No hay datos de administracion. <button onClick={()=>openEdit(resumen.condominio)} className="underline">Agregar ahora</button></span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab==='torres'&&(
            <div className="space-y-4">
              {condominios.length>1&&<div><label className={lbl}>Filtrar por condominio</label><select value={selectedCondominio||''} onChange={e=>{const v=Number(e.target.value);setSelectedCondominio(v);fetchTorres(v)}} className={inp+' max-w-xs'}>{condominios.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>}
              {torres.length===0?(
                <div className="text-center py-12 bg-white rounded-xl border border-slate-100">
                  <p className="text-slate-400 mt-2 text-sm">No hay torres registradas</p>
                  <button onClick={()=>{setFormTorre({nombre:'',numero_pisos:1,condominio_id:selectedCondominio||0});setShowModalTorre(true)}} className="mt-2 text-indigo-600 text-sm hover:underline">Crear primera torre</button>
                </div>
              ):(
                <div className="bg-white rounded-xl border border-slate-100 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100"><tr>{['Torre','Condominio','Pisos','Deptos (est.)','Acciones'].map(h=><th key={h} className="text-slate-500 font-medium text-left px-4 py-3">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-50">{torres.map(torre=>{const cond=condominios.find(c=>c.id===torre.condominio_id);return(
                    <tr key={torre.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-700">Torre {torre.nombre}</td>
                      <td className="px-4 py-3 text-slate-500">{cond?.nombre||'-'}</td>
                      <td className="px-4 py-3 text-slate-700">{torre.numero_pisos}</td>
                      <td className="px-4 py-3 text-slate-500">{torre.numero_pisos*4}</td>
                      <td className="px-4 py-3"><div className="flex gap-2">
                        <button onClick={()=>{window.location.href='/dashboard/condominios/estructura/'+torre.id}} className="px-3 py-1.5 text-xs rounded-lg font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100">Ver pisos</button>
                        <button onClick={()=>deleteTorre(torre.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                      </div></td>
                    </tr>
                  )})}</tbody>
                </table></div></div>
              )}
            </div>
          )}

          {tab==='condominios'&&(
            <div className="space-y-4">
              {condominios.length===0?(
                <div className="text-center py-16 bg-white rounded-xl border border-slate-100"><p className="text-slate-400 text-sm">No hay condominios registrados</p></div>
              ):(
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {condominios.map(cond=>{
                    const condTorres=torres.filter(t=>t.condominio_id===cond.id)
                    return(
                      <div key={cond.id} className={'bg-white rounded-xl border p-5 transition-all hover:shadow-md '+(selectedCondominio===cond.id?'border-indigo-400 ring-2 ring-indigo-100':'border-slate-100')}>
                        <div className="mb-3">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-slate-800 truncate">{cond.nombre}</h3>
                            {cond.tipo&&<span className={'px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 '+(TCOLORS[cond.tipo]||'bg-slate-100 text-slate-600')}>{TLABELS[cond.tipo]||cond.tipo}</span>}
                          </div>
                          <p className="text-xs text-slate-500">{cond.direccion}</p>
                          <p className="text-xs text-slate-400">{cond.ciudad||cond.comuna}{cond.region?', '+cond.region:''}</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mb-4">
                          <span>{condTorres.length>0?condTorres.length+' torre'+(condTorres.length!==1?'s':''):'Sin torres'}</span>
                          {cond.anno_construccion?<span>{'- '+cond.anno_construccion}</span>:null}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={()=>{setSelectedCondominio(cond.id);setTab('resumen')}} className="flex-1 px-3 py-1.5 text-xs rounded-lg font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100">Ver resumen</button>
                          <button onClick={()=>openEdit(cond)} className="flex-1 px-3 py-1.5 text-xs rounded-lg font-medium bg-slate-100 text-slate-700 hover:bg-slate-200">Editar</button>
                          <button onClick={()=>deleteCond(cond.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showModalCond&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-slate-800">{editingCond?'Editar Condominio':'Nuevo Condominio'}</h3>
              <button onClick={()=>setShowModalCond(false)} className="text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={saveCond} className="p-6 space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-100">Datos del Condominio / Edificio</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2"><label className={lbl}>Nombre *</label><input required value={formCond.nombre||''} onChange={fc('nombre')} placeholder="Condominio Los Olivos" className={inp} /></div>
                  <div><label className={lbl}>Tipo</label><select value={formCond.tipo||'edificio'} onChange={fc('tipo')} className={inp}><option value="edificio">Edificio</option><option value="condominio">Condominio</option><option value="townhouse">Townhouse</option><option value="casa">Casa</option></select></div>
                  <div><label className={lbl}>RUT Condominio</label><input value={formCond.rut_condominio||''} onChange={fc('rut_condominio')} placeholder="76.123.456-7" className={inp} /></div>
                  <div className="sm:col-span-2"><label className={lbl}>Direccion *</label><input required value={formCond.direccion||''} onChange={fc('direccion')} placeholder="Av. Principal 1234" className={inp} /></div>
                  <div><label className={lbl}>Ciudad</label><input value={formCond.ciudad||''} onChange={fc('ciudad')} placeholder="Santiago" className={inp} /></div>
                  <div><label className={lbl}>Comuna</label><input value={formCond.comuna||''} onChange={fc('comuna')} placeholder="Las Condes" className={inp} /></div>
                  <div><label className={lbl}>Region</label><input value={formCond.region||''} onChange={fc('region')} placeholder="Metropolitana" className={inp} /></div>
                  <div><label className={lbl}>Ano construccion</label><input type="number" value={formCond.anno_construccion||''} onChange={e=>setFormCond(p=>({...p,anno_construccion:Number(e.target.value)||undefined}))} placeholder="2010" className={inp} /></div>
                  <div><label className={lbl}>Metros totales</label><input type="number" step="0.01" value={formCond.metros_totales||''} onChange={e=>setFormCond(p=>({...p,metros_totales:Number(e.target.value)||undefined}))} placeholder="5000" className={inp} /></div>
                  <div><label className={lbl}>Telefono contacto</label><input value={formCond.telefono_contacto||''} onChange={fc('telefono_contacto')} placeholder="+56 9 1234 5678" className={inp} /></div>
                  <div><label className={lbl}>Email contacto</label><input type="email" value={formCond.email_contacto||''} onChange={fc('email_contacto')} placeholder="condominio@ejemplo.cl" className={inp} /></div>
                  <div className="sm:col-span-2"><label className={lbl}>Sitio web</label><input value={formCond.website||''} onChange={fc('website')} placeholder="https://..." className={inp} /></div>
                  <div className="sm:col-span-2">
                    <label className={lbl}>Logo del Condominio</label>
                    <div className="flex gap-3 items-center">
                      {formCond.logo_url && (
                        <img src={formCond.logo_url} alt="logo" className="w-14 h-14 rounded-xl object-cover border border-slate-700" onError={e=>{(e.target as HTMLImageElement).style.display='none'}} />
                      )}
                      <div className="flex-1 space-y-2">
                        <label className={`flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl border text-sm font-medium transition ${uploadingLogo ? 'opacity-50 cursor-not-allowed' : 'border-dashed border-slate-600 text-slate-400 hover:border-indigo-500 hover:text-indigo-400'}`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          {uploadingLogo ? 'Subiendo...' : 'Subir PNG/JPG'}
                          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploadingLogo} onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f) }} />
                        </label>
                        <input value={formCond.logo_url||''} onChange={fc('logo_url')} placeholder="O pega una URL de imagen..." className={inp} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-100">Administracion</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2"><label className={lbl}>Empresa administradora</label><input value={formCond.empresa_administradora||''} onChange={fc('empresa_administradora')} placeholder="Administraciones XYZ Ltda." className={inp} /></div>
                  <div><label className={lbl}>Nombre administrador</label><input value={formCond.administrador_nombre||''} onChange={fc('administrador_nombre')} placeholder="Juan Perez" className={inp} /></div>
                  <div><label className={lbl}>RUT administrador</label><input value={formCond.administrador_rut||''} onChange={fc('administrador_rut')} placeholder="12.345.678-9" className={inp} /></div>
                  <div><label className={lbl}>Telefono</label><input value={formCond.administrador_telefono||''} onChange={fc('administrador_telefono')} placeholder="+56 9 8765 4321" className={inp} /></div>
                  <div><label className={lbl}>Email</label><input type="email" value={formCond.administrador_email||''} onChange={fc('administrador_email')} placeholder="admin@empresa.cl" className={inp} /></div>
                  <div><label className={lbl}>Contrato desde</label><input type="date" value={formCond.contrato_inicio?String(formCond.contrato_inicio).split('T')[0]:''} onChange={fc('contrato_inicio')} className={inp} /></div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setShowModalCond(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2.5 text-sm hover:bg-slate-50">Cancelar</button>
                <button type="submit" className="flex-1 bg-indigo-600 text-white rounded-lg py-2.5 text-sm hover:bg-indigo-700 font-medium">{editingCond?'Guardar cambios':'Crear condominio'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModalTorre&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Nueva Torre</h3>
              <button onClick={()=>setShowModalTorre(false)} className="text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={createTorre} className="p-6 space-y-4">
              {condominios.length>1&&<div><label className={lbl}>Condominio *</label><select required value={formTorre.condominio_id||''} onChange={e=>setFormTorre(p=>({...p,condominio_id:Number(e.target.value)}))} className={inp}><option value="">-- seleccionar --</option>{condominios.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>}
              <div><label className={lbl}>Nombre / Letra *</label><input required value={formTorre.nombre} onChange={e=>setFormTorre(p=>({...p,nombre:e.target.value}))} placeholder="A, B, C o Norte, Sur..." className={inp} /></div>
              <div>
                <label className={lbl}>Numero de pisos *</label>
                <input required type="number" min={1} max={50} value={formTorre.numero_pisos} onChange={e=>setFormTorre(p=>({...p,numero_pisos:parseInt(e.target.value)}))} className={inp} />
                <p className="text-xs text-slate-400 mt-1">Los pisos se crearan automaticamente</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setShowModalTorre(false)} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm hover:bg-slate-50">Cancelar</button>
                <button type="submit" className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm hover:bg-indigo-700 font-medium">Crear Torre</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
