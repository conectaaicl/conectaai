'use client'
import { useState } from 'react'

interface Articulo {
  numero: string
  titulo: string
  texto: string
  categoria: string
}

const CATEGORIAS = ['Todos', 'Copropietarios', 'Propietarios', 'Residentes', 'Administracion', 'Asambleas', 'Gastos Comunes', 'Seguridad']

const ARTICULOS: Articulo[] = [
  {
    numero: 'Art. 1',
    titulo: 'Definicion de Copropiedad Inmobiliaria',
    categoria: 'Copropietarios',
    texto: 'Cada copropietario es dueno exclusivo de su unidad y comunero en los bienes de dominio comun. El dominio de cada unidad comprende un derecho de copropiedad sobre los bienes comunes, que es inseparable del dominio de la respectiva unidad.',
  },
  {
    numero: 'Art. 3',
    titulo: 'Bienes de Dominio Comun',
    categoria: 'Copropietarios',
    texto: 'Son bienes de dominio comun: los que sirvan a todos o algunos de los copropietarios para el uso o goce de sus respectivas unidades; los terrenos y espacios en que esten situados los edificios; las instalaciones generales y los artefactos o aparatos de uso o goce comun; y los recintos destinados al ejercicio de actividades comunes como conserjeria, porteria, sala de reunion, gimnasio, lavanderia, estacionamientos de visitas y otros analogos.',
  },
  {
    numero: 'Art. 5',
    titulo: 'Reglamento de Copropiedad',
    categoria: 'Administracion',
    texto: 'El reglamento de copropiedad debera establecer los derechos y obligaciones de los copropietarios, las limitaciones y prohibiciones en el uso de las unidades y bienes comunes, las normas relativas a la administracion y conservacion de los bienes comunes, y las formas de resolver las controversias que se susciten entre los copropietarios.',
  },
  {
    numero: 'Art. 10',
    titulo: 'Obligaciones del Copropietario',
    categoria: 'Copropietarios',
    texto: 'Todo copropietario o quien lo reemplace en el dominio, uso o goce de su unidad estara obligado a: (a) Asistir a las asambleas de copropietarios; (b) Pagar los gastos comunes en la forma y oportunidad que establezca el reglamento de copropiedad; (c) Mantener su unidad en condiciones que no perjudiquen a los demas copropietarios; (d) Velar por la seguridad y buen funcionamiento de los bienes comunes.',
  },
  {
    numero: 'Art. 13',
    titulo: 'Gastos Comunes — Obligacion de Pago',
    categoria: 'Gastos Comunes',
    texto: 'Cada copropietario debera contribuir tanto a los gastos comunes ordinarios como a los extraordinarios, en proporcion al derecho que le corresponda en los bienes de dominio comun, salvo que el reglamento de copropiedad establezca otra forma de contribucion. El no pago oportuno de los gastos comunes dara derecho a cobrar intereses corrientes y la deuda podra servir de titulo ejecutivo.',
  },
  {
    numero: 'Art. 14',
    titulo: 'Mora en Gastos Comunes',
    categoria: 'Gastos Comunes',
    texto: 'El copropietario moroso en el pago de los gastos comunes quedara privado del servicio de calefaccion, agua caliente u otros servicios comunes, si el reglamento de copropiedad lo establece, y podra ser demandado ejecutivamente. El administrador estara facultado para interponer demanda ejecutiva en nombre de la comunidad.',
  },
  {
    numero: 'Art. 17',
    titulo: 'Asamblea de Copropietarios — Tipos',
    categoria: 'Asambleas',
    texto: 'La asamblea de copropietarios es la autoridad maxima de la comunidad. Las asambleas pueden ser ordinarias o extraordinarias. Las asambleas ordinarias se celebran una vez al ano dentro de los tres meses siguientes al termino del ejercicio. Las asambleas extraordinarias se celebran cuando las circunstancias lo exijan o cuando lo soliciten copropietarios que representen a lo menos el treinta por ciento de los derechos en la comunidad.',
  },
  {
    numero: 'Art. 19',
    titulo: 'Quorum de Asamblea',
    categoria: 'Asambleas',
    texto: 'En primera citacion, la asamblea se constituira con la asistencia de los copropietarios que representen, a lo menos, el sesenta por ciento de los derechos en la comunidad. En segunda citacion, la asamblea se constituira con los copropietarios que asistan, cualquiera sea su numero. Los acuerdos se adoptaran por la mayoria de los asistentes, salvo los casos en que la ley o el reglamento exijan un quorum especial.',
  },
  {
    numero: 'Art. 23',
    titulo: 'Administrador — Designacion y Funciones',
    categoria: 'Administracion',
    texto: 'El administrador es la persona natural o juridica designada por la asamblea para administrar el condominio. Sus funciones incluyen: cuidar los bienes de dominio comun, ejecutar los acuerdos de la asamblea, representar a la comunidad en actos de administracion, cobrar y recaudar los gastos comunes, contratar al personal necesario, y velar por el cumplimiento del reglamento de copropiedad.',
  },
  {
    numero: 'Art. 25',
    titulo: 'Remocion del Administrador',
    categoria: 'Administracion',
    texto: 'El administrador podra ser removido en todo momento por acuerdo de la asamblea de copropietarios, sin expresion de causa. La remocion requiere el voto favorable de mas del cincuenta por ciento de los derechos en la comunidad. En caso de incumplimiento grave de sus obligaciones, cualquier copropietario podra solicitar la remocion al tribunal competente.',
  },
  {
    numero: 'Art. 32',
    titulo: 'Uso de Bienes Comunes',
    categoria: 'Residentes',
    texto: 'El uso y goce de los bienes de dominio comun corresponde a todos los copropietarios y, por extension, a los residentes autorizados. Cada copropietario puede servirse de los bienes comunes segun su naturaleza y destino ordinario, pero no podra emplearlos en otros objetos que los de su uso o goce ni turbar el justo uso de los demas copropietarios.',
  },
  {
    numero: 'Art. 33',
    titulo: 'Prohibiciones a Residentes',
    categoria: 'Residentes',
    texto: 'No se puede, sin previo permiso del administrador o de la asamblea: realizar obras que afecten los bienes comunes; instalar maquinarias o elementos que produzcan ruidos, vibraciones o humos molestos; alterar la fachada del edificio; efectuar cualquier acto o conducta que perturbe la tranquilidad de los demas copropietarios o residentes; ni tener animales que causen molestias a los demas.',
  },
  {
    numero: 'Art. 35',
    titulo: 'Arrendatarios y Ocupantes',
    categoria: 'Residentes',
    texto: 'El propietario que ceda el uso de su unidad a cualquier titulo quedara solidariamente responsable de los perjuicios que ocasionaren el arrendatario u ocupante, sin perjuicio de su derecho a repetir en contra de este. El arrendatario o residente debera cumplir las normas del reglamento de copropiedad y los acuerdos de la asamblea que les sean aplicables.',
  },
  {
    numero: 'Art. 36',
    titulo: 'Mascotas y Animales',
    categoria: 'Residentes',
    texto: 'La tenencia de animales domesticos en las unidades del condominio se regira por lo que establezca el reglamento de copropiedad. En todo caso, los propietarios o residentes con mascotas deberan adoptar las medidas necesarias para evitar molestias a los demas copropietarios y garantizar la limpieza de los bienes comunes.',
  },
  {
    numero: 'Art. 40',
    titulo: 'Seguridad del Condominio',
    categoria: 'Seguridad',
    texto: 'La comunidad podra establecer sistemas de control de acceso, video vigilancia y medidas de seguridad en bienes comunes, siempre que se respete la privacidad de los copropietarios en sus unidades privadas. Las grabaciones de camaras de seguridad tendran caracter reservado y solo podran ser utilizadas para fines de seguridad o entregadas a autoridades competentes.',
  },
  {
    numero: 'Art. 41',
    titulo: 'Registro de Visitas',
    categoria: 'Seguridad',
    texto: 'El condominio podra llevar un registro de visitas y accesos, el que sera manejado por el personal de conserjeria. Toda persona que no sea residente o propietario debera registrarse al momento de ingresar, identificarse y declarar el motivo de su visita. El conserje podra negar el acceso a personas que no cuenten con autorizacion del residente visitado.',
  },
  {
    numero: 'Art. 45',
    titulo: 'Infracciones y Sanciones',
    categoria: 'Administracion',
    texto: 'El incumplimiento de las normas del reglamento de copropiedad podra ser sancionado con multas cuyo monto determinara el propio reglamento. Las multas seran aplicadas por el administrador o por la asamblea, segun lo establezca el reglamento. El multado podra apelar ante la asamblea dentro del plazo que determine el reglamento de copropiedad.',
  },
  {
    numero: 'Art. 50',
    titulo: 'Derecho a Informacion',
    categoria: 'Copropietarios',
    texto: 'Todo copropietario tiene derecho a que el administrador le proporcione informacion sobre la gestion de la comunidad. El administrador debera presentar el balance de ingresos y egresos en la asamblea ordinaria anual. Cualquier copropietario puede solicitar al administrador, en cualquier momento, informacion detallada sobre el estado de las finanzas de la comunidad.',
  },
  {
    numero: 'Art. 55',
    titulo: 'Fondo de Reserva',
    categoria: 'Gastos Comunes',
    texto: 'El reglamento de copropiedad podra establecer la obligacion de constituir un fondo de reserva para atender a gastos imprevistos o de conservacion y reparacion de los bienes comunes. El fondo de reserva sera administrado por el administrador, que debera mantener una cuenta separada para estos recursos.',
  },
  {
    numero: 'Art. 60',
    titulo: 'Mediacion y Arbitraje',
    categoria: 'Administracion',
    texto: 'Las controversias que se susciten entre los copropietarios en relacion con los bienes comunes o el reglamento de copropiedad podran ser sometidas a mediacion ante el Centro de Mediacion del Ministerio de Justicia. En caso de no llegarse a acuerdo, las partes podran someter la controversia a arbitraje o recurrir a los tribunales ordinarios de justicia.',
  },
]

export default function LeyCopropiedadPage() {
  const [categoriaActiva, setCategoriaActiva] = useState('Todos')
  const [busqueda, setBusqueda] = useState('')
  const [copiado, setCopiado] = useState<string | null>(null)

  const articulosFiltrados = ARTICULOS.filter(a => {
    const matchCat = categoriaActiva === 'Todos' || a.categoria === categoriaActiva
    const q = busqueda.toLowerCase()
    const matchQ = !q || a.titulo.toLowerCase().includes(q) || a.texto.toLowerCase().includes(q) || a.numero.toLowerCase().includes(q)
    return matchCat && matchQ
  })

  function copiarArticulo(a: Articulo) {
    const texto = a.numero + ' — ' + a.titulo + '\n\n' + a.texto
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(a.numero)
      setTimeout(() => setCopiado(null), 2500)
    })
  }

  function copiarParaComunicado(a: Articulo) {
    const texto = 'Estimados copropietarios y residentes,\n\nSe les informa que de acuerdo a la Ley de Copropiedad Inmobiliaria (Ley 21.442), en su ' + a.numero + ' — ' + a.titulo + ':\n\n"' + a.texto + '"\n\nSin otro particular,\nLa Administracion'
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado('comunicado_' + a.numero)
      setTimeout(() => setCopiado(null), 2500)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Ley de Copropiedad Inmobiliaria</h1>
          <p className="text-slate-500 text-sm mt-1">Ley 21.442 — Chile · Articulos clave para la gestion de condominios</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-xs text-blue-700 text-right">
          <p className="font-semibold">Ley 21.442</p>
          <p>Vigente desde 2022</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-semibold mb-1">Aviso Legal</p>
        <p>Este compendio es de caracter referencial. Los articulos pueden haber sido simplificados para facilitar su comprension. Para efectos legales, consulte siempre el texto oficial de la Ley 21.442 publicada en el Diario Oficial.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar en la ley (articulo, tema...)"
          className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIAS.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoriaActiva(cat)}
            className={'px-3 py-1.5 rounded-full text-xs font-medium transition-colors ' + (
              categoriaActiva === cat
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-400">{articulosFiltrados.length} articulos encontrados</p>

      <div className="space-y-4">
        {articulosFiltrados.map(a => (
          <div key={a.numero} className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-200 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg">{a.numero}</span>
                  <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{a.categoria}</span>
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">{a.titulo}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{a.texto}</p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => copiarArticulo(a)}
                  className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ' + (
                    copiado === a.numero
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700'
                  )}
                >
                  {copiado === a.numero ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Copiado
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      Copiar
                    </>
                  )}
                </button>
                <button
                  onClick={() => copiarParaComunicado(a)}
                  className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ' + (
                    copiado === 'comunicado_' + a.numero
                      ? 'bg-green-100 text-green-700'
                      : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                  )}
                >
                  {copiado === 'comunicado_' + a.numero ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Listo
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      Como Comunicado
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
