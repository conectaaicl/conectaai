'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Stats {
  conversaciones: {
    total: number;
    activas: number;
  };
  leads: {
    total: number;
    calientes: number;
    ganados: number;
  };
  mensajes: {
    total: number;
  };
}

interface Lead {
  id: number;
  nombre: string;
  telefono: string;
  temperatura: string;
  canal_origen: string;
  interes: string;
  created_at: string;
}

const CANALES = {
  whatsapp: { icon: '💬', color: 'bg-green-500', label: 'WhatsApp' },
  instagram: { icon: '📸', color: 'bg-pink-500', label: 'Instagram' },
  facebook: { icon: '👥', color: 'bg-blue-600', label: 'Facebook' },
  telegram: { icon: '✈️', color: 'bg-sky-500', label: 'Telegram' },
  messenger: { icon: '💭', color: 'bg-blue-500', label: 'Messenger' },
  tiktok: { icon: '🎵', color: 'bg-black', label: 'TikTok' },
  email: { icon: '📧', color: 'bg-red-500', label: 'Email' },
  webchat: { icon: '💻', color: 'bg-indigo-500', label: 'WebChat' },
};

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<number | null>(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      
      // Obtener usuario actual
      const userResponse = await fetch('https://sistema.conectaai.cl/api/auth/me', {
        credentials: 'include',
      });
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setTenantId(userData.tenant_id);
        
        // Cargar stats
        const statsResponse = await fetch(`https://sistema.conectaai.cl/api/whatsapp360/stats?tenant_id=${userData.tenant_id}`, {
          credentials: 'include',
        });
        
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData);
        }

        // Cargar leads
        const leadsResponse = await fetch(`https://sistema.conectaai.cl/api/whatsapp360/leads?tenant_id=${userData.tenant_id}`, {
          credentials: 'include',
        });
        
        if (leadsResponse.ok) {
          const leadsData = await leadsResponse.json();
          setLeads(leadsData);
        }
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const leadsPorCanal = leads.reduce((acc, lead) => {
    const canal = lead.canal_origen?.toLowerCase() || 'otro';
    acc[canal] = (acc[canal] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const leadsPorTemperatura = leads.reduce((acc, lead) => {
    acc[lead.temperatura] = (acc[lead.temperatura] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const tasaConversion = stats && stats.leads.total > 0
    ? ((stats.leads.ganados / stats.leads.total) * 100).toFixed(1)
    : '0.0';

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInfoCanal = (canal: string) => {
    const canalLower = canal?.toLowerCase();
    return CANALES[canalLower as keyof typeof CANALES] || { icon: '📱', color: 'bg-gray-500', label: canal || 'Otro' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-700 font-semibold text-lg">Cargando estadísticas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-6">
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
          <span className="text-5xl">📊</span>
          Dashboard de Estadísticas
        </h1>
        <p className="text-gray-600 text-lg">Métricas en tiempo real de WhatsApp 360 - Todos los canales</p>
      </div>

      {/* Stats Cards principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-blue-500 transform hover:scale-105 transition">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-3xl">💬</span>
            </div>
            <span className="text-xs font-bold text-gray-500 bg-blue-50 px-3 py-1 rounded-full">Total</span>
          </div>
          <h3 className="text-gray-600 text-sm font-bold mb-1 uppercase tracking-wide">Conversaciones</h3>
          <p className="text-4xl font-extrabold text-gray-900">{stats?.conversaciones.total || 0}</p>
          <p className="text-sm text-green-600 mt-2 font-semibold">
            ✓ {stats?.conversaciones.activas || 0} activas
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-purple-500 transform hover:scale-105 transition">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-3xl">👥</span>
            </div>
            <span className="text-xs font-bold text-gray-500 bg-purple-50 px-3 py-1 rounded-full">Total</span>
          </div>
          <h3 className="text-gray-600 text-sm font-bold mb-1 uppercase tracking-wide">Leads Totales</h3>
          <p className="text-4xl font-extrabold text-gray-900">{stats?.leads.total || 0}</p>
          <p className="text-sm text-orange-600 mt-2 font-semibold">
            🔥 {stats?.leads.calientes || 0} calientes
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-green-500 transform hover:scale-105 transition">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-3xl">🎉</span>
            </div>
            <span className="text-xs font-bold text-gray-500 bg-green-50 px-3 py-1 rounded-full">Ganados</span>
          </div>
          <h3 className="text-gray-600 text-sm font-bold mb-1 uppercase tracking-wide">Clientes Ganados</h3>
          <p className="text-4xl font-extrabold text-gray-900">{stats?.leads.ganados || 0}</p>
          <p className="text-sm text-green-600 mt-2 font-semibold">
            Tasa: {tasaConversion}%
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border-l-4 border-yellow-500 transform hover:scale-105 transition">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-3xl">📨</span>
            </div>
            <span className="text-xs font-bold text-gray-500 bg-yellow-50 px-3 py-1 rounded-full">Total</span>
          </div>
          <h3 className="text-gray-600 text-sm font-bold mb-1 uppercase tracking-wide">Mensajes Enviados</h3>
          <p className="text-4xl font-extrabold text-gray-900">{stats?.mensajes.total || 0}</p>
          <p className="text-sm text-gray-500 mt-2 font-semibold">
            Todos los canales
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Leads por Canal */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span>📱</span>
            Leads por Canal
          </h3>
          <div className="space-y-4">
            {Object.entries(leadsPorCanal).length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay leads registrados</p>
            ) : (
              Object.entries(leadsPorCanal).map(([canal, cantidad]) => {
                const porcentaje = stats?.leads.total 
                  ? ((cantidad / stats.leads.total) * 100).toFixed(1)
                  : '0';
                
                const { icon, color, label } = getInfoCanal(canal);

                return (
                  <div key={canal} className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center shadow-md`}>
                        <span className="text-2xl">{icon}</span>
                      </div>
                      <span className="font-bold text-gray-900 text-lg capitalize">{label}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-40 bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all"
                          style={{ width: `${porcentaje}%` }}
                        ></div>
                      </div>
                      <span className="text-lg font-bold text-gray-700 w-16 text-right">
                        {cantidad}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Leads por Temperatura */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span>🌡️</span>
            Distribución de Temperatura
          </h3>
          <div className="space-y-4">
            {[
              { temp: 'frio', label: 'Fríos', color: 'from-blue-500 to-blue-600', icono: '❄️' },
              { temp: 'tibio', label: 'Tibios', color: 'from-yellow-500 to-yellow-600', icono: '🌤️' },
              { temp: 'caliente', label: 'Calientes', color: 'from-orange-500 to-orange-600', icono: '🔥' },
              { temp: 'ganado', label: 'Ganados', color: 'from-green-500 to-green-600', icono: '🎉' },
            ].map(({ temp, label, color, icono }) => {
              const cantidad = leadsPorTemperatura[temp] || 0;
              const porcentaje = stats?.leads.total 
                ? ((cantidad / stats.leads.total) * 100).toFixed(1)
                : '0';

              return (
                <div key={temp} className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center shadow-md text-white text-2xl`}>
                      {icono}
                    </div>
                    <span className="font-bold text-gray-900 text-lg">{label}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-40 bg-gray-200 rounded-full h-3">
                      <div
                        className={`bg-gradient-to-r ${color} h-3 rounded-full transition-all`}
                        style={{ width: `${porcentaje}%` }}
                      ></div>
                    </div>
                    <span className="text-lg font-bold text-gray-700 w-16 text-right">
                      {cantidad}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Actividad Reciente */}
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <span>⚡</span>
          Actividad Reciente
        </h3>
        <div className="space-y-3">
          {leads.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay actividad reciente</p>
          ) : (
            leads.slice(0, 10).map((lead) => {
              const { icon, color } = getInfoCanal(lead.canal_origen);
              return (
                <div key={lead.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl hover:shadow-md transition border border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center text-white shadow-md`}>
                      <span className="text-2xl">{icon}</span>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-lg">{lead.nombre}</p>
                      <p className="text-sm text-gray-600">{lead.telefono}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-4 py-2 rounded-xl text-sm font-bold shadow-sm ${
                      lead.temperatura === 'frio' ? 'bg-blue-100 text-blue-700' :
                      lead.temperatura === 'tibio' ? 'bg-yellow-100 text-yellow-700' :
                      lead.temperatura === 'caliente' ? 'bg-orange-100 text-orange-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {lead.temperatura === 'frio' ? '❄️' :
                       lead.temperatura === 'tibio' ? '🌤️' :
                       lead.temperatura === 'caliente' ? '🔥' : '🎉'} {lead.temperatura}
                    </span>
                    <p className="text-xs text-gray-500 mt-2">{formatearFecha(lead.created_at)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Métricas adicionales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl shadow-xl p-8 text-white">
          <h4 className="text-sm font-bold mb-3 opacity-90 uppercase tracking-wide">Tasa de Respuesta</h4>
          <p className="text-5xl font-extrabold">
            {stats && stats.conversaciones.total > 0
              ? ((stats.conversaciones.activas / stats.conversaciones.total) * 100).toFixed(1)
              : '0'}%
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl shadow-xl p-8 text-white">
          <h4 className="text-sm font-bold mb-3 opacity-90 uppercase tracking-wide">Promedio Msgs/Conv</h4>
          <p className="text-5xl font-extrabold">
            {stats && stats.conversaciones.total > 0
              ? (stats.mensajes.total / stats.conversaciones.total).toFixed(1)
              : '0'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-2xl shadow-xl p-8 text-white">
          <h4 className="text-sm font-bold mb-3 opacity-90 uppercase tracking-wide">Tasa de Conversión</h4>
          <p className="text-5xl font-extrabold">{tasaConversion}%</p>
        </div>
      </div>
    </div>
  );
}
