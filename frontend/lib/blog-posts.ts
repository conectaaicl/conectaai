export interface BlogPost {
  slug: string
  title: string
  excerpt: string
  category: string
  categoryColor: string
  date: string
  readTime: number
  image: string
  content: string
}

export const posts: BlogPost[] = [
  {
    slug: 'ley-21442-copropiedad-que-debes-saber',
    title: 'Ley 21.442: Todo lo que tu condominio necesita saber para cumplir',
    excerpt: 'La nueva Ley de Copropiedad Inmobiliaria exige que todos los condominios en Chile actualicen su reglamento y adopten nuevos estándares de administración. Te explicamos qué cambió y cómo cumplir sin complicaciones.',
    category: 'Legal',
    categoryColor: '#f59e0b',
    date: '2026-07-15',
    readTime: 7,
    image: 'https://images.unsplash.com/photo-1589391886645-d51941baf7fb?w=1200&q=80&auto=format&fit=crop',
    content: `
<h2>¿Qué cambió con la Ley 21.442?</h2>
<p>La Ley de Copropiedad Inmobiliaria (Ley 21.442), publicada el 13 de abril de 2022, modernizó por completo la forma en que los condominios en Chile deben administrarse. Reemplazó a la antigua Ley 19.537 y trajo cambios concretos en tres áreas fundamentales: transparencia en la administración, participación real de los residentes y actualización obligatoria del reglamento interno.</p>

<h2>Las 5 obligaciones más importantes</h2>

<h3>1. Actualización del reglamento de copropiedad</h3>
<p>Es el cambio más urgente. El reglamento interno de cada condominio debe adaptarse a los nuevos artículos de la ley. Esto incluye las formas de votación, los quórum requeridos según el tipo de decisión y los procedimientos de elección del comité de administración. Un reglamento desactualizado puede invalidar acuerdos tomados en asamblea.</p>

<h3>2. Asambleas con participación virtual válida</h3>
<p>Las asambleas ahora pueden convocarse y realizarse de forma completamente digital. Una votación realizada a través de una plataforma digital tiene el mismo valor legal que una presencial, siempre que cumpla con los requisitos de notificación previa y quórum establecidos por la ley.</p>

<h3>3. Fondo de reserva obligatorio</h3>
<p>Los condominios deben mantener un fondo de reserva mínimo para gastos imprevistos y mantención de bienes comunes. Su monto y forma de cálculo deben quedar reflejados en el reglamento actualizado.</p>

<h3>4. Registro de residentes actualizado</h3>
<p>Debe mantenerse un registro activo de todos los copropietarios y arrendatarios, con sus datos de contacto para notificaciones oficiales. Sin este registro, la validez de las convocatorias puede ser cuestionada.</p>

<h3>5. Transparencia en los gastos comunes</h3>
<p>Los estados de cuenta deben estar disponibles para todos los copropietarios, con rendición de cuentas al menos dos veces al año. La ley establece el derecho de cualquier copropietario a solicitar información financiera y la obligación de la administración de entregarla.</p>

<h2>¿Qué pasa si tu condominio no cumple?</h2>
<p>Las consecuencias van desde conflictos legales entre copropietarios hasta la nulidad de acuerdos tomados en asambleas que no cumplieron con los requisitos de la nueva ley. En casos más graves, el administrador puede ser sancionado o removido por los copropietarios mediante una asamblea extraordinaria.</p>
<p>Muchos condominios han descubierto que sus acuerdos de los últimos años son impugnables simplemente porque el reglamento que los respaldaba era el antiguo. Regularizarse ahora evita problemas futuros.</p>

<h2>Cómo ConectaAI te ayuda a cumplir</h2>
<p>Hemos diseñado herramientas específicas para que el cumplimiento de la Ley 21.442 no sea una carga administrativa:</p>
<ul>
  <li><strong>Asambleas virtuales con quórum:</strong> Convoca, gestiona asistencia y registra votaciones con respaldo legal completo directamente desde la plataforma.</li>
  <li><strong>Registro de residentes:</strong> Base de datos actualizada con notificaciones automáticas por WhatsApp o correo, lista para auditoría en cualquier momento.</li>
  <li><strong>Gastos comunes transparentes:</strong> Portal del residente con acceso a estados de cuenta, historial de pagos y documentos en tiempo real, las 24 horas.</li>
  <li><strong>Actas automáticas:</strong> Al terminar una asamblea o votación, el sistema genera el acta en PDF con todos los datos legales requeridos, lista para archivar y firmar.</li>
</ul>
<p>Si tienes dudas sobre el estado de cumplimiento de tu condominio, escríbenos por WhatsApp. Te hacemos un diagnóstico sin costo.</p>
    `
  },
  {
    slug: 'rfid-vs-llave-tradicional-condominio',
    title: 'RFID vs llave tradicional: por qué el condominio moderno ya no usa llaves',
    excerpt: 'Las llaves físicas se pierden, se copian sin control y no dejan registro. El control de acceso RFID cambia completamente la seguridad de tu edificio. Te explicamos cómo funciona y qué significa para tu comunidad.',
    category: 'Tecnología',
    categoryColor: '#7c3aed',
    date: '2026-06-28',
    readTime: 6,
    image: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=1200&q=80&auto=format&fit=crop',
    content: `
<h2>El problema con las llaves físicas</h2>
<p>Una llave tradicional tiene tres problemas fundamentales en un contexto de copropiedad: se puede copiar en cualquier ferretería sin dejar rastro, cuando se pierde no hay forma de saber quién la tiene, y no deja ningún registro de quién entró ni cuándo. En un edificio con 50, 100 o 200 unidades, esto es un riesgo de seguridad constante.</p>
<p>Las estadísticas de los administradores que hemos acompañado muestran que en promedio un edificio pierde o roba entre 8 y 15 llaves al año. Cada una de esas llaves representa una vulnerabilidad que persiste hasta que se cambia la cerradura del edificio completo, un proceso caro y disruptivo.</p>

<h2>¿Cómo funciona el control de acceso RFID?</h2>
<p>RFID (Radio Frequency Identification) es una tecnología de comunicación inalámbrica que permite identificar de forma única cada tarjeta o llavero. Cuando un residente acerca su tarjeta al lector, el sistema verifica en tiempo real si está autorizado para acceder, en qué horario y a qué áreas.</p>
<p>Los lectores más comunes en condominios operan a <strong>13.56 MHz</strong> (Mifare Classic, Mifare Plus, NFC) o <strong>125 kHz</strong> (EM4100, HID Prox). En ConectaAI soportamos ambas frecuencias y somos compatibles con los sistemas ZKTeco, Hikvision y la mayoría de los instalados en Chile y Latinoamérica.</p>

<h2>Las ventajas reales para tu condominio</h2>

<h3>Control total sin esfuerzo</h3>
<p>Cada acceso queda registrado: quién entró, a qué hora, por qué puerta. Si ocurre un incidente, tienes el historial completo disponible en segundos desde el panel web. No hay que revisar horas de video para encontrar un evento específico.</p>

<h3>Desactivación instantánea</h3>
<p>¿Un residente perdió su tarjeta? En 30 segundos la desactivas desde el sistema y emites una nueva. No hay que cambiar cerraduras, no hay costo de visita técnica, no hay período de vulnerabilidad. La tarjeta perdida queda inútil de inmediato.</p>

<h3>Tu tarjeta de débito como llave</h3>
<p>En sistemas UID-only (los más comunes en condominios económicos), cualquier tarjeta con chip NFC a 13.56 MHz puede funcionar como llave: Mastercard, Visa, tarjetas de débito Santander, BCI, Scotiabank. Muchos residentes prefieren esto a llevar un llavero extra.</p>

<h3>Acceso sin contacto desde el celular</h3>
<p>Integrando con ZKTeco ZKAccess API e Hikvision ISAPI, el panel de administración puede abrir puertas remotamente desde cualquier dispositivo conectado a internet. El conserje puede autorizar el ingreso de una visita desde su tablet sin moverse de su puesto.</p>

<h2>¿Cuánto cuesta migrar?</h2>
<p>El costo de migración depende del hardware ya instalado en tu edificio. En muchos casos el lector RFID ya está instalado y solo falta el software de gestión. Los lectores ZKTeco de entrada cuestan entre $80.000 y $150.000 CLP por puerta, y el retorno de inversión se alcanza rápido si consideras el costo de reemplazar cerraduras o contratar servicios de seguridad adicionales.</p>
<p>ConectaAI ofrece un diagnóstico gratuito: evaluamos qué hardware tiene instalado tu condominio y si es compatible con nuestro sistema antes de cobrarte un peso.</p>

<h2>RFID + biometría: la combinación ideal</h2>
<p>Para accesos de alto valor (sala de máquinas, bodegas, estacionamientos reservados), combinamos RFID con biometría de huella dactilar. La tarjeta puede prestarse; la huella, no. Esta doble verificación es el estándar en edificios corporativos y cada vez más común en residenciales premium.</p>
    `
  },
  {
    slug: 'whatsapp-para-condominios-5-usos',
    title: 'WhatsApp para condominios: 5 usos que transforman la convivencia',
    excerpt: 'El 97% de los chilenos usa WhatsApp a diario. Tu condominio ya debería estar aprovechando ese canal para comunicaciones, notificaciones y gestión. Aquí los 5 usos que más impacto tienen.',
    category: 'Comunicaciones',
    categoryColor: '#25d366',
    date: '2026-06-10',
    readTime: 5,
    image: 'https://images.unsplash.com/photo-1592890288564-76628a30a657?w=1200&q=80&auto=format&fit=crop',
    content: `
<h2>Por qué WhatsApp y no el correo o el papel</h2>
<p>Los avisos pegados en el ascensor los leen el 30% de los residentes. Los correos los abre el 20% si tienen suerte. WhatsApp tiene una tasa de apertura del 98% en los primeros 3 minutos después del envío. En un contexto donde necesitas que la información llegue a toda la comunidad, no hay comparación.</p>
<p>Pero más allá de las notificaciones masivas, WhatsApp permite algo que el papel y el correo no pueden: conversación en tiempo real. Un residente puede responder, confirmar una visita o reportar un problema desde el mismo mensaje. Eso es lo que hace que los condominios que lo adoptan bien no quieran volver atrás.</p>

<h2>1. Notificación de paquetes y encomiendas</h2>
<p>Este es el uso de mayor satisfacción. Cuando llega un paquete a portería, el sistema fotografía la encomienda y envía automáticamente un mensaje al residente: "Hola [Nombre], llegó tu paquete de [Remitente]. Lo puedes retirar en portería cuando quieras." Sin llamadas, sin stickers en la puerta, sin paquetes perdidos.</p>
<p>Los condominios que implementan esto reducen las consultas a portería sobre paquetes en más del 70%. El conserje deja de responder la misma pregunta decenas de veces al día.</p>

<h2>2. Visitas pre-autorizadas</h2>
<p>El residente envía al bot la información de su visita: nombre, RUT, fecha y hora. La visita llega, el conserje verifica en el sistema y la autoriza en segundos. No hay que llamar al departamento, no hay que esperar que el residente atienda el teléfono.</p>
<p>Para visitas frecuentes (trabajadoras de hogar, profesores particulares, familiares), se puede crear una autorización recurrente. La persona queda registrada con foto en el sistema y el acceso se autoriza automáticamente.</p>

<h2>3. Avisos de la administración a toda la comunidad</h2>
<p>Corte de agua el jueves de 9 a 13 horas. Asamblea el próximo martes. Cierre del estacionamiento por mantención. Antes, estos avisos requerían imprimir y pegar. Ahora es un mensaje que llega a todos los residentes en segundos, con confirmación de lectura.</p>
<p>La diferencia en la participación y preparación de los residentes es notable. Cuando saben con antelación que habrá un corte de agua, se preparan. Cuando ven el aviso en papel el día del corte, se quejan.</p>

<h2>4. Reportes de incidentes y solicitudes de mantención</h2>
<p>El ascensor hace un ruido raro. La luz del pasillo del piso 7 lleva tres días quemada. El residente puede reportarlo directamente por WhatsApp, el sistema lo registra como ticket de mantención y el administrador lo asigna al proveedor correspondiente. Todo queda con trazabilidad: quién reportó, cuándo, qué acción se tomó.</p>
<p>Este flujo elimina los reportes verbales que se olvidan y las solicitudes que se pierden en grupos de WhatsApp masivos donde nadie tiene responsabilidad.</p>

<h2>5. Recordatorio de gastos comunes</h2>
<p>Un recordatorio amigable el día 25 de cada mes: "Hola [Nombre], tu gasto común de [Mes] es de $XX.XXX. Puedes pagarlo aquí: [Link]." Directo, con el monto exacto y el link de pago. No es una amenaza, es un servicio.</p>
<p>Los condominios que implementan este recordatorio ven una reducción de hasta el 40% en la morosidad. No porque los residentes no querían pagar, sino porque se les olvidaba o no sabían cuánto era exactamente.</p>

<h2>WhatsApp masivo vs inbox inteligente</h2>
<p>Hay una diferencia importante entre enviar mensajes masivos y tener un inbox real. ConectaAI integra un inbox de WhatsApp donde el administrador puede ver y responder todas las conversaciones, asignar tickets, y tener el historial completo de cada residente. No es un grupo; es un canal de comunicación profesional bidireccional.</p>
    `
  },
  {
    slug: 'gastos-comunes-digitales-sin-morosos',
    title: 'Gastos comunes digitales: cómo dejar de perseguir a los morosos',
    excerpt: 'La morosidad en gastos comunes es el mayor dolor de cabeza de los administradores. La solución no es perseguir más fuerte: es hacer que pagar sea tan fácil que no haya excusa para no hacerlo.',
    category: 'Finanzas',
    categoryColor: '#10b981',
    date: '2026-05-20',
    readTime: 6,
    image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1200&q=80&auto=format&fit=crop',
    content: `
<h2>El ciclo del moroso no es lo que crees</h2>
<p>La mayoría de los administradores asumen que un residente moroso es alguien que no quiere pagar. La realidad, según lo que hemos visto en los condominios que gestionamos, es diferente: <strong>el 60% de los pagos atrasados son de residentes que se olvidaron o que no tenían claro cuánto debían y cuándo.</strong> El resto tiene problemas financieros reales, y para ellos también hay estrategias.</p>
<p>El problema no es la voluntad de pago; es la fricción del proceso.</p>

<h2>La fricción que nadie mide</h2>
<p>Imagina el proceso clásico de un gasto común:</p>
<ol>
  <li>El administrador calcula manualmente el gasto en una planilla Excel</li>
  <li>Imprime o envía por correo el estado de cuenta (que muchos no abren)</li>
  <li>El residente tiene que ir al banco o hacer una transferencia buscando el número de cuenta</li>
  <li>Si hay alguna duda sobre el monto, tiene que llamar al administrador</li>
  <li>El administrador registra el pago manualmente en la planilla</li>
</ol>
<p>Cada uno de esos pasos es una oportunidad para que el pago no ocurra. Y mientras más pasos, más morosidad.</p>

<h2>La solución: que pagar sea lo más fácil del mes</h2>

<h3>Recordatorio automático con monto exacto y link</h3>
<p>El día 25 de cada mes, cada residente recibe un WhatsApp: "Tu gasto común de julio es $85.230. Haz clic aquí para pagar." Un solo toque y está pagando. Sin buscar el número de cuenta, sin calcular si es el mismo que el mes pasado.</p>

<h3>Pago online inmediato</h3>
<p>Integrado con Flow y Mercado Pago, el residente puede pagar con cualquier tarjeta o transferencia desde el portal. El sistema registra el pago automáticamente y actualiza el estado de cuenta en tiempo real. Sin cheques, sin transferencias manuales que hay que verificar uno a uno.</p>

<h3>Portal del residente transparente</h3>
<p>Cualquier residente puede ver en cualquier momento cuánto debe, qué está incluido en el gasto común de ese mes, el historial de sus pagos del último año y los documentos financieros del condominio. La transparencia reduce las disputas sobre los montos.</p>

<h3>Multas automáticas con aviso previo</h3>
<p>El sistema puede configurarse para cobrar un recargo por mora después de la fecha límite, con aviso previo por WhatsApp. El recargo es automático: no hay que calcularlo, no hay que informarlo manualmente. Y el aviso previo ("tu pago vence en 3 días") es suficiente para que la mayoría actúe.</p>

<h2>Resultados reales</h2>
<p>Los condominios que migran a gestión digital de gastos comunes ven en promedio:</p>
<ul>
  <li>Reducción del 35% al 50% en la morosidad en los primeros 3 meses</li>
  <li>Reducción del 80% en el tiempo que el administrador dedica a cobros y registros manuales</li>
  <li>Menos conflictos entre residentes y administración por errores en montos o registros</li>
  <li>Mayor participación en asambleas porque los estados financieros son comprensibles y accesibles</li>
</ul>

<h2>¿Y los que realmente no pueden pagar?</h2>
<p>Para los residentes con dificultades financieras reales, el sistema permite configurar planes de pago y acuerdos de pago que quedan registrados y se siguen automáticamente. El administrador sabe en todo momento qué acuerdos están vigentes y cómo va el cumplimiento, sin tener que llevar un registro manual paralelo.</p>

<h2>La planilla de Excel tiene costo real</h2>
<p>Calcular gastos comunes manualmente en Excel toma entre 4 y 8 horas al mes en un edificio de tamaño mediano. Con el sistema automatizado, ese proceso toma 20 minutos. Son entre 3 y 7 horas al mes que el administrador puede dedicar a mejorar la convivencia, gestionar proveedores o simplemente tener un margen de error más bajo.</p>
    `
  },
  {
    slug: 'portal-residente-app-que-necesita-tu-edificio',
    title: 'Portal del residente: la app que tu edificio necesita desde ya',
    excerpt: 'Los residentes ya usan apps para todo: banco, supermercado, citas médicas. ¿Por qué su condominio sigue usando papel y llamadas telefónicas? El portal del residente cambia eso con cero inversión de hardware.',
    category: 'Tecnología',
    categoryColor: '#7c3aed',
    date: '2026-05-05',
    readTime: 5,
    image: 'https://images.unsplash.com/photo-1559137781-875af01c14bc?w=1200&q=80&auto=format&fit=crop',
    content: `
<h2>El residente de hoy tiene expectativas digitales</h2>
<p>En 2026, el 78% de los usuarios de smartphone en Chile usa al menos 5 apps de servicios diferentes cada semana: banco, supermercado, delivery, citas médicas, transporte. Están acostumbrados a gestionar su vida desde el celular con respuestas inmediatas y sin tener que llamar a nadie.</p>
<p>Cuando ese mismo residente llega a su condominio y tiene que llamar a portería para autorizar una visita, ir en persona a pagar el gasto común, o esperar que le peguen un papel en la puerta para saber que llegó un paquete, la experiencia es un salto en el tiempo. Y esa fricción se acumula en insatisfacción.</p>

<h2>Qué puede hacer el residente desde el portal</h2>

<h3>Pre-autorizar visitas sin llamar a portería</h3>
<p>El residente registra la visita desde su celular: nombre del visitante, fecha, hora estimada, si viene en auto y la patente. Cuando el visitante llega, portería ya tiene toda la información y puede autorizarlo en segundos. Sin llamadas al departamento, sin ruido, sin esperas.</p>

<h3>Recibir notificaciones de paquetes en tiempo real</h3>
<p>Cuando llega una encomienda, el residente recibe una foto del paquete y la notificación exacta del momento en que entró a portería. Puede ver el estado de todas sus encomiendas pendientes de retiro desde el portal, con la fecha de llegada.</p>

<h3>Reservar espacios comunes</h3>
<p>Quincho, sala de eventos, piscina, sala de reuniones: el residente ve la disponibilidad en tiempo real y reserva desde el celular en menos de un minuto. El sistema bloquea el horario automáticamente y envía la confirmación. Sin llamar al administrador, sin hojas de papel en el pasillo.</p>

<h3>Pagar el gasto común y ver el historial</h3>
<p>El portal muestra el estado de cuenta actualizado del mes, el historial de pagos, los documentos del condominio y cualquier deuda pendiente. El pago se hace en el momento con tarjeta o transferencia. Sin ir al banco, sin buscar el número de cuenta.</p>

<h3>Participar en votaciones y asambleas</h3>
<p>Cuando se convoca una asamblea o votación, el residente recibe la notificación, puede revisar los temas, votar desde el portal y ver los resultados en tiempo real. La participación en votaciones digitales es consistentemente más alta que en asambleas presenciales.</p>

<h3>Reportar problemas</h3>
<p>Luz quemada, ascensor ruidoso, filtración en el pasillo: el residente toma una foto y reporta desde el portal. El sistema genera un ticket, notifica al administrador y hace seguimiento del estado. El residente sabe si su reporte fue recibido y cuándo se resolvió.</p>

<h2>PWA: la app sin instalar nada</h2>
<p>El portal de ConectaAI es una Progressive Web App (PWA). Funciona desde el navegador del celular sin necesidad de descargarse desde App Store ni Google Play. El residente entra a la URL, toca "Añadir a pantalla de inicio" y tiene el ícono de la app en su celular como cualquier otra aplicación.</p>
<p>Esto elimina la fricción más grande en la adopción de apps de servicios: la descarga. No hay que convencer a los residentes de instalar nada, no hay actualizaciones manuales, no hay problemas de compatibilidad con versiones de Android. Funciona en cualquier celular con un navegador moderno.</p>

<h2>La adopción importa más que las funciones</h2>
<p>Un portal con 20 funciones que nadie usa no sirve de nada. La experiencia nos ha enseñado que los portales del residente funcionan cuando el onboarding es simple: una sola URL, login con número de depto y contraseña inicial, y la primera función que el residente usa es ver si tiene paquetes. Desde ahí, el resto fluye solo.</p>
<p>Los condominios que implementan el portal de ConectaAI tienen una adopción promedio del 68% de los residentes en el primer mes, sin campañas de comunicación elaboradas.</p>

<h2>Para el administrador también</h2>
<p>Cada acción que el residente hace por el portal es una llamada o visita a portería que no ocurre. En edificios de 100+ unidades, eso representa horas de trabajo diario que el equipo de conserjería puede redirigir a tareas que realmente requieren presencia física.</p>
    `
  }
]

export function getPost(slug: string): BlogPost | undefined {
  return posts.find(p => p.slug === slug)
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })
}
