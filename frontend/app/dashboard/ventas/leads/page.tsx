'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Lead {
  id: number;
  nombre: string;
  telefono: string;
  email: string;
  temperatura: string;
  canal_origen: string;
  interes: string;
  notas: string;
  created_at: string;
  tenant_id: number;
}

const CANALES = {
  whatsapp: { icon: '💬', color: 'bg-green-500' },
  instagram: { icon: '📸', color: 'bg-pink-500' },
  facebook: { icon: '👥', color: 'bg-blue-600' },
  telegram: { icon: '✈️', color: 'bg-sky-500' },
  messenger: { icon: '💭', color: 'bg-blue-500' },
  tiktok: { icon: '🎵', color: 'bg-black' },
  email: { icon: '📧', color: 'bg-red-500' },
  webchat: { icon: '💻', color: 'bg-indigo-500' },
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [leadSeleccionado, setLeadSeleccionado] = useState<Lead | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [tenantId, setTenantId] = useState<number | null>(null);

  useEffect(() => {
    cargarUsuarioYLeads();
  }, []);

  const cargarUsuarioYLeads = async () => {
    try {
      setLoading(true);
      
      // Obtener usuario actual
      const userResponse = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setTenantId(userData.tenant_id);
        
        // Cargar leads con tenant_id correcto
        await cargarLeads(userData.tenant_id);
      }
    } catch (error) {
      console.error('Error cargando usuario:', error);
    } finally {
      setLoading(false);
    }
  };

  const cargarLeads = async (tenant_id: number) => {
    try {
      const response = await fetch(`/api/whatsapp360/leads?tenant_id=${tenant_id}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setLeads(data);
      }
    } catch (error) {
      console.error('Error cargando leads:', error);
    }
  };

  const cambiarTemperatura = async (leadId: number, nuevaTemperatura: string) => {
    if (!tenantId) return;
    
    try {
      const response = await fetch(`/api/whatsapp360/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          temperatura: nuevaTemperatura,
          tenant_id: tenantId,
        }),
      });

      if (response.ok) {
        await cargarLeads(tenantId);
      }
    } catch (error) {
      console.error('Error actualizando lead:', error);
    }
  };

  const leadsPorTemperatura = {
    frio: leads.filter(l => l.temperatura === 'frio'),
    tibio: leads.filter(l => l.temperatura === 'tibio'),
    caliente: leads.filter(l => l.temperatura === 'caliente'),
    ganado: leads.filter(l => l.temperatura === 'ganado'),
  };

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getColorTemperatura = (temp: string) => {
    switch (temp) {
      case 'frio':
        return 'bg-blue-50 border-blue-300 text-blue-800';
      case 'tibio':
        return 'bg-yellow-50 border-yellow-300 text-yellow-800';
      case 'caliente':
        return 'bg-orange-50 border-orange-300 text-orange-800';
      case 'ganado':
        return 'bg-green-50 border-green-300 text-green-800';
      default:
        return 'bg-gray-50 border-gray-300 text-gray-800';
    }
  };

  const getIconoTemperatura = (temp: string) => {
    switch (temp) {
      case 'frio':
        return '❄️';
      case 'tibio':
        return '🌤️';
      case 'caliente':
        return '🔥';
      case 'ganado':
        return '🎉';
      default:
        return '📌';
    }
  };

  const getInfoCanal = (canal: string) => {
    const canalLower = canal?.toLowerCase();
    return CANALES[canalLower as keyof typeof CANALES] || { icon: '📱', color: 'bg-gray-500' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-700 font-semibold">Cargando leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      {/* Botón Atrás */}
      <div className="mb-4">
        <Link
          href="/dashboard/ventas"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-md hover:shadow-lg transition text-gray-700 font-semibold"
        >
          ← Atrás
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2 flex items-center gap-3">
          <span className="text-5xl">🔥</span>
          Panel de Leads
        </h1>
        <p className="text-gray-600 text-lg">Gestiona y da seguimiento a tus prospectos desde todos los canales</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-500 transform hover:scale-105 transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1 font-semibold">Fríos</p>
              <p className="text-4xl font-bold text-blue-600">{leadsPorTemperatura.frio.length}</p>
            </div>
            <div className="text-5xl">❄️</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-yellow-500 transform hover:scale-105 transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1 font-semibold">Tibios</p>
              <p className="text-4xl font-bold text-yellow-600">{leadsPorTemperatura.tibio.length}</p>
            </div>
            <div className="text-5xl">🌤️</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-orange-500 transform hover:scale-105 transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1 font-semibold">Calientes</p>
              <p className="text-4xl font-bold text-orange-600">{leadsPorTemperatura.caliente.length}</p>
            </div>
            <div className="text-5xl">🔥</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500 transform hover:scale-105 transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1 font-semibold">Ganados</p>
              <p className="text-4xl font-bold text-green-600">{leadsPorTemperatura.ganado.length}</p>
            </div>
            <div className="text-5xl">🎉</div>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Columna Fríos */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-5 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <h3 className="font-bold text-lg flex items-center gap-3">
              <span className="text-3xl">❄️</span>
              <div>
                <div>Fríos</div>
                <div className="text-sm opacity-90">{leadsPorTemperatura.frio.length} leads</div>
              </div>
            </h3>
          </div>
          <div className="p-4 space-y-3 min-h-[400px] max-h-[600px] overflow-y-auto">
            {leadsPorTemperatura.frio.map((lead) => {
              const { icon, color } = getInfoCanal(lead.canal_origen);
              return (
                <div
                  key={lead.id}
                  onClick={() => {
                    setLeadSeleccionado(lead);
                    setMostrarModal(true);
                  }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg transform hover:-translate-y-1 ${getColorTemperatura(lead.temperatura)}`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-lg flex-shrink-0`}>
                      {icon}
                    </div>
                    <h4 className="font-bold flex-1">{lead.nombre}</h4>
                  </div>
                  <p className="text-xs mb-2 font-medium">{lead.telefono}</p>
                  <p className="text-xs mb-3 line-clamp-2">{lead.interes}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        cambiarTemperatura(lead.id, 'tibio');
                      }}
                      className="text-xs px-3 py-1.5 bg-white rounded-lg hover:bg-yellow-100 transition font-semibold shadow-sm"
                    >
                      → Tibio
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Columna Tibios */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
            <h3 className="font-bold text-lg flex items-center gap-3">
              <span className="text-3xl">🌤️</span>
              <div>
                <div>Tibios</div>
                <div className="text-sm opacity-90">{leadsPorTemperatura.tibio.length} leads</div>
              </div>
            </h3>
          </div>
          <div className="p-4 space-y-3 min-h-[400px] max-h-[600px] overflow-y-auto">
            {leadsPorTemperatura.tibio.map((lead) => {
              const { icon, color } = getInfoCanal(lead.canal_origen);
              return (
                <div
                  key={lead.id}
                  onClick={() => {
                    setLeadSeleccionado(lead);
                    setMostrarModal(true);
                  }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg transform hover:-translate-y-1 ${getColorTemperatura(lead.temperatura)}`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-lg flex-shrink-0`}>
                      {icon}
                    </div>
                    <h4 className="font-bold flex-1">{lead.nombre}</h4>
                  </div>
                  <p className="text-xs mb-2 font-medium">{lead.telefono}</p>
                  <p className="text-xs mb-3 line-clamp-2">{lead.interes}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        cambiarTemperatura(lead.id, 'frio');
                      }}
                      className="text-xs px-2 py-1.5 bg-white rounded-lg hover:bg-blue-100 transition font-semibold shadow-sm"
                    >
                      ← Frío
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        cambiarTemperatura(lead.id, 'caliente');
                      }}
                      className="text-xs px-2 py-1.5 bg-white rounded-lg hover:bg-orange-100 transition font-semibold shadow-sm"
                    >
                      → Caliente
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Columna Calientes */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-5 bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <h3 className="font-bold text-lg flex items-center gap-3">
              <span className="text-3xl">🔥</span>
              <div>
                <div>Calientes</div>
                <div className="text-sm opacity-90">{leadsPorTemperatura.caliente.length} leads</div>
              </div>
            </h3>
          </div>
          <div className="p-4 space-y-3 min-h-[400px] max-h-[600px] overflow-y-auto">
            {leadsPorTemperatura.caliente.map((lead) => {
              const { icon, color } = getInfoCanal(lead.canal_origen);
              return (
                <div
                  key={lead.id}
                  onClick={() => {
                    setLeadSeleccionado(lead);
                    setMostrarModal(true);
                  }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg transform hover:-translate-y-1 ${getColorTemperatura(lead.temperatura)}`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-lg flex-shrink-0`}>
                      {icon}
                    </div>
                    <h4 className="font-bold flex-1">{lead.nombre}</h4>
                  </div>
                  <p className="text-xs mb-2 font-medium">{lead.telefono}</p>
                  <p className="text-xs mb-3 line-clamp-2">{lead.interes}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        cambiarTemperatura(lead.id, 'tibio');
                      }}
                      className="text-xs px-2 py-1.5 bg-white rounded-lg hover:bg-yellow-100 transition font-semibold shadow-sm"
                    >
                      ← Tibio
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        cambiarTemperatura(lead.id, 'ganado');
                      }}
                      className="text-xs px-2 py-1.5 bg-white rounded-lg hover:bg-green-100 transition font-semibold shadow-sm"
                    >
                      ✓ Ganado
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Columna Ganados */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-5 bg-gradient-to-r from-green-500 to-green-600 text-white">
            <h3 className="font-bold text-lg flex items-center gap-3">
              <span className="text-3xl">🎉</span>
              <div>
                <div>Ganados</div>
                <div className="text-sm opacity-90">{leadsPorTemperatura.ganado.length} leads</div>
              </div>
            </h3>
          </div>
          <div className="p-4 space-y-3 min-h-[400px] max-h-[600px] overflow-y-auto">
            {leadsPorTemperatura.ganado.map((lead) => {
              const { icon, color } = getInfoCanal(lead.canal_origen);
              return (
                <div
                  key={lead.id}
                  onClick={() => {
                    setLeadSeleccionado(lead);
                    setMostrarModal(true);
                  }}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg transform hover:-translate-y-1 ${getColorTemperatura(lead.temperatura)}`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-lg flex-shrink-0`}>
                      {icon}
                    </div>
                    <h4 className="font-bold flex-1">{lead.nombre}</h4>
                  </div>
                  <p className="text-xs mb-2 font-medium">{lead.telefono}</p>
                  <p className="text-xs mb-3 line-clamp-2">{lead.interes}</p>
                  <p className="text-xs text-green-700 font-bold mt-2">✓ Cliente activo</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal de detalles */}
      {mostrarModal && leadSeleccionado && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold">Detalles del Lead</h2>
                <button
                  onClick={() => setMostrarModal(false)}
                  className="text-white hover:text-gray-200 text-3xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-600 uppercase tracking-wide">Nombre</label>
                <p className="text-xl text-gray-900 font-semibold">{leadSeleccionado.nombre}</p>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-600 uppercase tracking-wide">Teléfono</label>
                <p className="text-xl text-gray-900 font-semibold">{leadSeleccionado.telefono}</p>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-600 uppercase tracking-wide">Email</label>
                <p className="text-xl text-gray-900 font-semibold">{leadSeleccionado.email || 'No especificado'}</p>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-600 uppercase tracking-wide">Canal de Origen</label>
                <div className="flex items-center gap-3 mt-1">
                  <div className={`w-10 h-10 rounded-full ${getInfoCanal(leadSeleccionado.canal_origen).color} flex items-center justify-center text-white text-xl`}>
                    {getInfoCanal(leadSeleccionado.canal_origen).icon}
                  </div>
                  <p className="text-xl text-gray-900 font-semibold capitalize">{leadSeleccionado.canal_origen}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-600 uppercase tracking-wide">Interés</label>
                <p className="text-lg text-gray-900">{leadSeleccionado.interes}</p>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-600 uppercase tracking-wide">Temperatura</label>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-4 py-2 rounded-xl text-base font-bold ${getColorTemperatura(leadSeleccionado.temperatura)}`}>
                    {getIconoTemperatura(leadSeleccionado.temperatura)} {leadSeleccionado.temperatura.toUpperCase()}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-600 uppercase tracking-wide">Notas</label>
                <p className="text-gray-900 whitespace-pre-wrap bg-gray-50 p-4 rounded-xl">{leadSeleccionado.notas || 'Sin notas'}</p>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-600 uppercase tracking-wide">Fecha de creación</label>
                <p className="text-gray-900 font-semibold">{formatearFecha(leadSeleccionado.created_at)}</p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => setMostrarModal(false)}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-bold hover:from-purple-700 hover:to-blue-700 transition shadow-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
