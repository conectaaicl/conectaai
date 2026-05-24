'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Conversacion {
  id: number;
  canal: string;
  contacto_telefono: string;
  contacto_nombre: string;
  estado: string;
  ultima_interaccion: string;
  tenant_id: number;
}

interface Mensaje {
  id: number;
  conversacion_id: number;
  tipo: string;
  contenido: string;
  created_at: string;
  direccion: string;
}

const CANALES_DISPONIBLES = [
  { key: 'todos', label: 'Todos', icon: '📱', color: 'bg-gray-500' },
  { key: 'whatsapp', label: 'WhatsApp', icon: '💬', color: 'bg-green-500' },
  { key: 'instagram', label: 'Instagram', icon: '📸', color: 'bg-pink-500' },
  { key: 'facebook', label: 'Facebook', icon: '👥', color: 'bg-blue-600' },
  { key: 'telegram', label: 'Telegram', icon: '✈️', color: 'bg-sky-500' },
  { key: 'messenger', label: 'Messenger', icon: '💭', color: 'bg-blue-500' },
  { key: 'tiktok', label: 'TikTok', icon: '🎵', color: 'bg-black' },
  { key: 'email', label: 'Email', icon: '📧', color: 'bg-red-500' },
  { key: 'webchat', label: 'WebChat', icon: '💻', color: 'bg-indigo-500' },
];

export default function InboxPage() {
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [conversacionActiva, setConversacionActiva] = useState<Conversacion | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCanal, setFiltroCanal] = useState<string>('todos');
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [tenantId, setTenantId] = useState<number | null>(null);

  useEffect(() => {
    cargarUsuarioYDatos();
  }, []);

  useEffect(() => {
    if (conversacionActiva) {
      cargarMensajes(conversacionActiva.id);
    }
  }, [conversacionActiva]);

  const cargarUsuarioYDatos = async () => {
    try {
      setLoading(true);
      
      // Primero obtener el usuario actual
      const userResponse = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setTenantId(userData.tenant_id);
        
        // Ahora cargar conversaciones con el tenant_id correcto
        await cargarConversaciones(userData.tenant_id);
      }
    } catch (error) {
      console.error('Error cargando usuario:', error);
    } finally {
      setLoading(false);
    }
  };

  const cargarConversaciones = async (tenant_id: number) => {
    try {
      const response = await fetch(`/api/whatsapp360/conversaciones?tenant_id=${tenant_id}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setConversaciones(data);
        if (data.length > 0 && !conversacionActiva) {
          setConversacionActiva(data[0]);
        }
      }
    } catch (error) {
      console.error('Error cargando conversaciones:', error);
    }
  };

  const cargarMensajes = async (conversacionId: number) => {
    if (!tenantId) return;
    
    try {
      const response = await fetch(`/api/whatsapp360/mensajes/${conversacionId}?tenant_id=${tenantId}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setMensajes(data);
      }
    } catch (error) {
      console.error('Error cargando mensajes:', error);
    }
  };

  const enviarMensaje = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conversacionActiva || !nuevoMensaje.trim() || !tenantId) return;

    try {
      const response = await fetch('/api/whatsapp360/mensajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          conversacion_id: conversacionActiva.id,
          tipo: 'texto',
          contenido: nuevoMensaje.trim(),
          direccion: 'saliente',
          enviado_por: 'agente',
          tenant_id: tenantId,
        }),
      });

      if (response.ok) {
        setNuevoMensaje('');
        await cargarMensajes(conversacionActiva.id);
      }
    } catch (error) {
      console.error('Error enviando mensaje:', error);
    }
  };

  const conversacionesFiltradas = filtroCanal === 'todos'
    ? conversaciones
    : conversaciones.filter(c => c.canal.toLowerCase() === filtroCanal.toLowerCase());

  const formatearFecha = (fecha: string) => {
    const d = new Date(fecha);
    const hoy = new Date();
    const esHoy = d.toDateString() === hoy.toDateString();
    
    if (esHoy) {
      return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
  };

  const getInfoCanal = (canal: string) => {
    const canalLower = canal.toLowerCase();
    const canalInfo = CANALES_DISPONIBLES.find(c => c.key === canalLower);
    return canalInfo || { icon: '📱', color: 'bg-gray-500' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-700 font-semibold">Cargando conversaciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Botón Atrás */}
      <div className="absolute top-4 left-4 z-10">
        <Link
          href="/dashboard/ventas"
          className="px-4 py-2 bg-white rounded-lg shadow-md hover:shadow-lg transition flex items-center gap-2 text-gray-700 font-semibold"
        >
          ← Atrás
        </Link>
      </div>

      {/* Panel izquierdo - Lista de conversaciones */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col shadow-lg mt-16">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <h1 className="text-2xl font-bold mb-4">💬 Bandeja de Mensajes</h1>
          
          {/* Filtros por canal - Scrolleable */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/30">
            {CANALES_DISPONIBLES.map((canal) => (
              <button
                key={canal.key}
                onClick={() => setFiltroCanal(canal.key)}
                className={`px-3 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 whitespace-nowrap ${
                  filtroCanal === canal.key
                    ? 'bg-white text-blue-600 shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                <span>{canal.icon}</span>
                <span>{canal.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Lista de conversaciones */}
        <div className="flex-1 overflow-y-auto">
          {conversacionesFiltradas.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-5xl mb-3">📭</p>
              <p className="font-semibold">No hay conversaciones</p>
              <p className="text-sm mt-1">en {filtroCanal === 'todos' ? 'ningún canal' : filtroCanal}</p>
            </div>
          ) : (
            conversacionesFiltradas.map((conv) => {
              const { icon, color } = getInfoCanal(conv.canal);
              return (
                <div
                  key={conv.id}
                  onClick={() => setConversacionActiva(conv)}
                  className={`p-4 border-b border-gray-100 cursor-pointer transition hover:bg-blue-50 ${
                    conversacionActiva?.id === conv.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar con icono del canal */}
                    <div className={`w-12 h-12 rounded-full ${color} flex items-center justify-center text-white text-2xl flex-shrink-0 shadow-md`}>
                      {icon}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-gray-900 truncate">
                          {conv.contacto_nombre || conv.contacto_telefono}
                        </h3>
                        <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                          {formatearFecha(conv.ultima_interaccion)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500 capitalize font-medium">{conv.canal}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          conv.estado === 'activa' ? 'bg-green-100 text-green-700' :
                          conv.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {conv.estado}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Panel derecho - Ventana de chat */}
      <div className="flex-1 flex flex-col mt-16">
        {conversacionActiva ? (
          <>
            {/* Header del chat */}
            <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full ${getInfoCanal(conversacionActiva.canal).color} flex items-center justify-center text-white text-2xl shadow-md`}>
                  {getInfoCanal(conversacionActiva.canal).icon}
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 text-lg">
                    {conversacionActiva.contacto_nombre || conversacionActiva.contacto_telefono}
                  </h2>
                  <p className="text-sm text-gray-500 capitalize flex items-center gap-2">
                    <span className="font-semibold">{conversacionActiva.canal}</span>
                    <span>•</span>
                    <span>{conversacionActiva.estado}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Área de mensajes */}
            <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-gray-50 to-gray-100">
              {mensajes.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <p className="text-6xl mb-3">💬</p>
                    <p className="text-lg font-semibold">Inicia la conversación</p>
                    <p className="text-sm mt-1">Envía el primer mensaje</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 max-w-4xl mx-auto">
                  {mensajes.map((mensaje) => (
                    <div
                      key={mensaje.id}
                      className={`flex ${mensaje.direccion === 'saliente' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-md px-4 py-3 rounded-2xl shadow-md ${
                          mensaje.direccion === 'saliente'
                            ? 'bg-blue-600 text-white rounded-br-sm'
                            : 'bg-white text-gray-900 rounded-bl-sm'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{mensaje.contenido}</p>
                        <div className={`text-xs mt-2 flex items-center gap-1 ${
                          mensaje.direccion === 'saliente' ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          <span>{formatearFecha(mensaje.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Input de mensaje */}
            <div className="bg-white border-t border-gray-200 p-4 shadow-lg">
              <form onSubmit={enviarMensaje} className="flex gap-3 max-w-4xl mx-auto">
                <input
                  type="text"
                  value={nuevoMensaje}
                  onChange={(e) => setNuevoMensaje(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 px-5 py-3 border-2 border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={!nuevoMensaje.trim()}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full font-bold hover:from-blue-700 hover:to-purple-700 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Enviar
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="text-center">
              <p className="text-8xl mb-6">💬</p>
              <p className="text-2xl font-bold text-gray-700">Selecciona una conversación</p>
              <p className="text-sm mt-2 text-gray-500">Elige un chat para comenzar a conversar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
