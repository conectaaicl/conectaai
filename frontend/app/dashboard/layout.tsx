'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/hooks/useSession'
import { useDarkMode } from '@/hooks/useDarkMode'
import { ToastProvider } from '@/components/Toast'
import CondominioSelector from '@/components/CondominioSelector'

interface NavItem {
  href: string
  label: string
  icon: string
  exact?: boolean
  featureKey?: string
}

interface NavGroup {
  label: string
  items: NavItem[]
  superadminOnly?: boolean
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'INICIO',
    items: [
      { href: '/dashboard', label: 'Monitor del Sistema', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 17a2 2 0 002 2h2a2 2 0 002-2m0 0V7m0 10a2 2 0 012 2h2a2 2 0 012-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2', exact: true },
    ],
  },
  {
    label: 'PERSONAS',
    items: [
      { href: '/dashboard/condominios/personas', label: 'Propietarios y Residentes', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
      { href: '/dashboard/condominios/conserjes', label: 'Conserjes y Personal', icon: 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 01-18 0z', featureKey: 'personal' },
      { href: '/dashboard/condominios/administradores', label: 'Administradores', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    ],
  },
  {
    label: 'EDIFICIO',
    items: [
      { href: '/dashboard/condominios/estructura', label: 'Estructura del Edificio', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    ],
  },
  {
    label: 'SEGURIDAD Y ACCESO',
    items: [
      { href: '/dashboard/condominios/puertas', label: 'Puertas y Accesos', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', featureKey: 'puertas' },
      { href: '/dashboard/condominios/kiosco-acceso', label: 'Kiosco de Prueba (RFID/Código)', icon: 'M9 17V7a2 2 0 012-2h2a2 2 0 012 2v10M5 21h14a2 2 0 002-2v-2a2 2 0 00-2-2H5a2 2 0 00-2 2v2a2 2 0 002 2z', featureKey: 'puertas' },
      { href: '/dashboard/condominios/rfid', label: 'RFID y Tarjetas QR', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z', featureKey: 'rfid' },
      { href: '/dashboard/condominios/camaras', label: 'Camaras IP', icon: 'M15 10l4.553-2.069A1 1 0 0121 8.87V15.13a1 1 0 01-1.447.9L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', featureKey: 'camaras' },
      { href: '/dashboard/condominios/facial', label: 'Reconocimiento Facial', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0zm-9 0a9 9 0 1118 0 9 9 0 01-18 0z', featureKey: 'facial' },
      { href: '/dashboard/condominios/facial-web', label: 'Reconocimiento Facial (Celular)', icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M12 17a4 4 0 100-8 4 4 0 000 8z', featureKey: 'facial_web' },
      { href: '/dashboard/condominios/huellas', label: 'Biometria (Huellas)', icon: 'M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4', featureKey: 'biometrico' },
      { href: '/dashboard/condominios/alarmas', label: 'Alarmas', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', featureKey: 'alarmas' },
      { href: '/dashboard/condominios/conexiones', label: 'Conexiones TCP/IP', icon: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0' },
    ],
  },
  {
    label: 'OPERACIONES',
    items: [
      { href: '/dashboard/condominios/visitas', label: 'Visitas', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', featureKey: 'visitas' },
      { href: '/dashboard/condominios/paqueteria', label: 'Paqueteria', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', featureKey: 'paqueteria' },
      { href: '/dashboard/condominios/accesos', label: 'Accesos QR', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', featureKey: 'accesos_qr' },
      { href: '/dashboard/condominios/accesos-live', label: 'Monitor Accesos Live', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', featureKey: 'accesos_qr' },
      { href: '/dashboard/condominios/reservas', label: 'Reservas', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', featureKey: 'reservas' },
      { href: '/dashboard/condominios/ordenes', label: 'Ordenes de Trabajo', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', featureKey: 'ordenes' },
      { href: '/dashboard/condominios/checklist', label: 'Checklist de Rondas', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', featureKey: 'checklist' },
      { href: '/dashboard/condominios/mascotas', label: 'Mascotas', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064', featureKey: 'mascotas' },
    ],
  },
  {
    label: 'COMUNICACIONES',
    items: [
      { href: '/dashboard/condominios/avisos', label: 'Avisos y Circulares', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', featureKey: 'avisos' },
      { href: '/dashboard/condominios/comunicaciones', label: 'Centro de Comunicacion', icon: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0', featureKey: 'comunicaciones' },
      { href: '/dashboard/condominios/mensajes', label: 'Mensajes', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
      { href: '/dashboard/condominios/votaciones', label: 'Votaciones', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', featureKey: 'votaciones' },
      { href: '/dashboard/condominios/asambleas', label: 'Asambleas', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', featureKey: 'asambleas' },
      { href: '/dashboard/condominios/documentos', label: 'Documentos', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', featureKey: 'documentos' },
      { href: '/dashboard/condominios/ley-copropiedad', label: 'Ley de Copropiedad', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', featureKey: 'ley_copropiedad' },
    ],
  },
  {
    label: 'FINANZAS',
    items: [
      { href: '/dashboard/condominios/gastos-comunes', label: 'Gastos Comunes', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', featureKey: 'gastos_comunes' },
      { href: '/dashboard/condominios/finanzas', label: 'Finanzas y Pagos', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', featureKey: 'finanzas' },
      { href: '/dashboard/condominios/presupuesto', label: 'Presupuesto', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M9 10V7a3 3 0 016 0v3m-9 4h12a2 2 0 002-2V9a2 2 0 00-2-2H6a2 2 0 00-2 2v4a2 2 0 002 2z', featureKey: 'presupuesto' },
      { href: '/dashboard/condominios/pagos-config', label: 'Config. de Pagos', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', featureKey: 'pagos_online' },
      { href: '/dashboard/condominios/multas', label: 'Multas', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', featureKey: 'multas' },
      { href: '/dashboard/condominios/proveedores', label: 'Proveedores', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', featureKey: 'proveedores' },
      { href: '/dashboard/condominios/remuneraciones', label: 'Remuneraciones', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', featureKey: 'remuneraciones' },
      { href: '/dashboard/condominios/sii', label: 'Facturacion SII', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', featureKey: 'sii_facturacion' },
    ],
  },
  {
    label: 'ANALITICA E IA',
    items: [
      { href: '/dashboard/condominios/incidencias', label: 'Incidencias', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', featureKey: 'incidencias' },
      { href: '/dashboard/condominios/reportes', label: 'Reportes Excel', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', featureKey: 'reportes' },
      { href: '/dashboard/condominios/resumenes', label: 'Resumenes Semanales', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', featureKey: 'resumenes_ia' },
      { href: '/dashboard/condominios/anomalias', label: 'Deteccion de Anomalias', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', featureKey: 'anomalias' },
      { href: '/dashboard/condominios/ia-chat', label: 'Asistente IA', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', featureKey: 'asistente_ia' },
    ],
  },
  {
    label: 'SISTEMA',
    items: [
      { href: '/dashboard/historial', label: 'Historial de Actividad', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
      { href: '/dashboard/condominios/alertas-sistema', label: 'Alertas del Sistema', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
      { href: '/dashboard/condominios/notificaciones-push', label: 'Notificaciones Push', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', featureKey: 'push_notificaciones' },
      { href: '/dashboard/condominios/dispositivos', label: 'Dispositivos Bio', icon: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18', featureKey: 'biometrico' },
      { href: '/dashboard/condominios/personal', label: 'Personal y RRHH', icon: 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2', featureKey: 'personal' },
      { href: '/dashboard/condominios/asistencia', label: 'Asistencia Personal', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', featureKey: 'asistencia' },
      { href: '/dashboard/noc', label: 'NOC', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 17a2 2 0 002 2h2a2 2 0 002-2m0 0V7m0 10a2 2 0 012 2h2a2 2 0 012-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2', featureKey: 'noc' },
      { href: '/dashboard/condominios/migracion', label: 'Migracion de Datos', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
      { href: '/dashboard/configuracion', label: 'Configuracion', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
      { href: '/dashboard/perfil', label: 'Mi Perfil', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    ],
  },
  {
    label: 'VENTAS Y CRM',
    items: [
      { href: '/dashboard/ventas', label: 'Pipeline de Ventas', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 17a2 2 0 002 2h2a2 2 0 002-2m0 0V7m0 10a2 2 0 012 2h2a2 2 0 012-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2', featureKey: 'crm_ventas', exact: true },
      { href: '/dashboard/ventas/cotizaciones', label: 'Cotizaciones', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', featureKey: 'crm_ventas' },
      { href: '/dashboard/ventas/reportes', label: 'Reportes CRM', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', featureKey: 'crm_ventas' },
      { href: '/dashboard/integraciones', label: 'Integraciones', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
    ],
  },
  {
    label: 'SUPERADMIN',
    superadminOnly: true,
    items: [
      { href: '/dashboard/superadmin', label: 'Panel SuperAdmin', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
      { href: '/dashboard/superadmin/features', label: 'Feature Flags', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    ],
  },
]

// Sidebar dedicado para tenants tipo "gimnasio": nav minimo (no el mega-menu de condominios).
// Reutiliza paginas ya existentes (RFID/facial/puertas/reservas/pagos) en vez de crear
// paginas nuevas que aun no existen en el backend.
const GYM_NAV_GROUPS: NavGroup[] = [
  {
    label: 'INICIO',
    items: [
      { href: '/dashboard', label: 'Panel del Gimnasio', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 17a2 2 0 002 2h2a2 2 0 002-2m0 0V7m0 10a2 2 0 012 2h2a2 2 0 012-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2', exact: true },
    ],
  },
  {
    label: 'SOCIOS Y ACCESOS',
    items: [
      { href: '/dashboard/condominios/personas', label: 'Socios', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
      { href: '/dashboard/condominios/rfid', label: 'RFID y Tarjetas', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z', featureKey: 'rfid' },
      { href: '/dashboard/condominios/facial', label: 'Reconocimiento Facial', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0zm-9 0a9 9 0 1118 0 9 9 0 01-18 0z', featureKey: 'facial' },
      { href: '/dashboard/condominios/puertas', label: 'Control de Puertas', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', featureKey: 'puertas' },
      { href: '/dashboard/condominios/accesos-live', label: 'Monitor de Accesos', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', featureKey: 'accesos_qr' },
    ],
  },
  {
    label: 'CLASES Y RESERVAS',
    items: [
      { href: '/dashboard/condominios/reservas', label: 'Reservas y Clases', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', featureKey: 'reservas' },
    ],
  },
  {
    label: 'COBROS',
    items: [
      { href: '/dashboard/condominios/gym-membresias', label: 'Planes y Membresias', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', featureKey: 'membresias' },
      { href: '/dashboard/condominios/pagos-config', label: 'Config. de Pagos', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', featureKey: 'pagos_online' },
      { href: '/dashboard/condominios/finanzas', label: 'Finanzas y Pagos', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', featureKey: 'finanzas' },
    ],
  },
  {
    label: 'COMUNICACION Y REPORTES',
    items: [
      { href: '/dashboard/condominios/comunicaciones', label: 'Centro de Comunicacion', icon: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0', featureKey: 'comunicaciones' },
      { href: '/dashboard/condominios/avisos', label: 'Avisos', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', featureKey: 'avisos' },
      { href: '/dashboard/condominios/incidencias', label: 'Incidencias', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', featureKey: 'incidencias' },
      { href: '/dashboard/condominios/reportes', label: 'Reportes', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', featureKey: 'reportes' },
    ],
  },
  {
    label: 'SISTEMA',
    items: [
      { href: '/dashboard/configuracion', label: 'Configuracion', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
      { href: '/dashboard/perfil', label: 'Mi Perfil', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    ],
  },
]

function NavIcon({ d }: { d: string }) {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={d} />
    </svg>
  )
}


function CondominioAvatar() {
  const [logo, setLogo] = useState<string | null>(null)
  const [nombre, setNombre] = useState<string>('')

  useEffect(() => {
    function read() {
      const stored = localStorage.getItem('active_condominio')
      if (stored) {
        try {
          const c = JSON.parse(stored)
          setLogo(c.logo_url || null)
          setNombre(c.nombre || '')
        } catch {}
      }
    }
    read()
    window.addEventListener('storage', read)
    return () => window.removeEventListener('storage', read)
  }, [])

  if (!logo) return null
  return (
    <img
      src={logo}
      alt={nombre}
      title={nombre}
      className="w-8 h-8 rounded-xl object-cover border border-slate-200 dark:border-slate-700/60 flex-shrink-0"
      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  )
}

function MorosidadBadge() {
  const [mora, setMora] = useState<number | null>(null)

  useEffect(() => {
    const condId = typeof window !== 'undefined' ? localStorage.getItem('current_condominio_id') : null
    if (!condId) return

    async function fetchMora() {
      try {
        const [pendRes, totalRes] = await Promise.all([
          fetch('/api/finanzas/gastos?tenant_id=' + condId + '&estado=pendiente'),
          fetch('/api/finanzas/gastos?tenant_id=' + condId),
        ])
        if (!pendRes.ok || !totalRes.ok) return
        const pend = await pendRes.json()
        const total = await totalRes.json()
        const pendCount = Array.isArray(pend) ? pend.length : (pend.total || 0)
        const totalCount = Array.isArray(total) ? total.length : (total.total || 0)
        if (totalCount > 0) setMora(Math.round((pendCount / totalCount) * 100))
      } catch (_) { /* ignore */ }
    }

    fetchMora()
    const interval = setInterval(fetchMora, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (mora === null) return null

  const isGood = mora === 0
  const isMid = mora > 0 && mora < 20
  const colorClass = isGood
    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
    : isMid
    ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
    : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20'
  const dotClass = isGood ? 'bg-emerald-500 dark:bg-emerald-400' : isMid ? 'bg-amber-500 dark:bg-amber-400' : 'bg-red-500 dark:bg-red-400'

  return (
    <span className={`hidden sm:flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${colorClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full pulse-dot ${dotClass}`} />
      {mora}% mora
    </span>
  )
}


// Bell Alerts
function BellDropdown() {
  const [open, setOpen] = useState(false)
  const [alertas, setAlertas] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const fetchAlertas = useCallback(async () => {
    const tid = typeof window !== 'undefined' ? localStorage.getItem('current_condominio_id') : null
    if (!tid) return
    try {
      const [rsRes, listRes] = await Promise.all([
        fetch('/api/alertas-sistema/resumen?tenant_id=' + tid),
        fetch('/api/alertas-sistema?tenant_id=' + tid + '&limit=8'),
      ])
      if (rsRes.ok) {
        const rs = await rsRes.json()
        setTotal(Object.values(rs as Record<string,number>).reduce((a: number, b: unknown) => a + (b as number), 0))
      }
      if (listRes.ok) setAlertas(await listRes.json())
    } catch {}
  }, [])

  useEffect(() => {
    fetchAlertas()
    const iv = setInterval(fetchAlertas, 30000)
    return () => clearInterval(iv)
  }, [fetchAlertas])

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const NIVEL_COLOR: Record<string,string> = {
    critico: 'text-red-600 dark:text-red-400', alto: 'text-orange-600 dark:text-orange-400',
    medio: 'text-yellow-600 dark:text-yellow-400', bajo: 'text-accent-600 dark:text-accent-400',
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all duration-200"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {total > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center px-0.5 pulse-dot">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl shadow-slate-900/10 dark:shadow-black/50 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">Alertas del Sistema</span>
            {total > 0 && <span className="text-xs bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">{total} activas</span>}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {alertas.length === 0 ? (
              <div className="px-4 py-6 text-center text-slate-400 dark:text-slate-500 text-sm">
                Sin alertas activas
              </div>
            ) : alertas.map((a: any) => (
              <div key={a.id} className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-start gap-2">
                  <span className={'text-xs font-bold mt-0.5 uppercase ' + (NIVEL_COLOR[a.nivel] || 'text-slate-400')}>
                    {a.nivel}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{a.titulo}</p>
                    {a.descripcion && <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{a.descripcion}</p>}
                    {a.servicio && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{a.servicio}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700">
            <a href="/dashboard/condominios/alertas-sistema" onClick={() => setOpen(false)} className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300">
              Ver todas las alertas
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function ProfileDropdown({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const initials = user?.nombre_completo?.split(" ").map((n: string) => n[0]).slice(0, 2).join("") || "?"
  const ROL_LABEL: Record<string,string> = {
    superadmin: 'Super Admin', admin: 'Administrador',
    conserje: 'Conserje', residente: 'Residente',
  }

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 hover:ring-2 hover:ring-brand-400 transition-all"
        style={{ background: 'linear-gradient(135deg, #14B8A6, #0F766E)' }}
        title={user?.nombre_completo}
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl shadow-slate-900/10 dark:shadow-black/50 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user?.nombre_completo || 'Usuario'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email || ''}</p>
            <span className="inline-block mt-1 text-xs bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-full">
              {ROL_LABEL[user?.rol] || user?.rol || ''}
            </span>
          </div>
          <div className="py-1">
            <a
              href="/dashboard/condominios/estructura"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Configuracion
            </a>
          </div>
          <div className="border-t border-slate-100 dark:border-slate-700 py-1">
            <button
              onClick={() => { setOpen(false); onLogout() }}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Cerrar Sesion
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [navSearch, setNavSearch] = useState('')
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useSession()
  const { isDark, toggle: toggleDark } = useDarkMode()
  const initials = user?.nombre_completo?.split(" ").map((n: string) => n[0]).slice(0, 2).join("") || "?"

  // Tenants tipo "gimnasio" ven un sidebar dedicado y minimo, no el mega-menu de condominios
  const [tenantTipo, setTenantTipo] = useState<string>('condominio')
  const groups = tenantTipo === 'gimnasio' && user?.rol !== 'superadmin' ? GYM_NAV_GROUPS : NAV_GROUPS

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    groups.forEach(g => {
      init[g.label] = g.items.some(i => i.exact ? pathname === i.href : pathname.startsWith(i.href))
    })
    return init
  })

  // Feature flags: load active features for current tenant
  const [activeFeatures, setActiveFeatures] = useState<string[]>([])
  const hasFeature = useCallback((key: string) => {
    if (activeFeatures.length === 0) return true // superadmin or no features loaded yet → show all
    return activeFeatures.includes(key)
  }, [activeFeatures])

  useEffect(() => {
    const CACHE_KEY = 'tenant_features_cache'
    const CACHE_TTL = 5 * 60 * 1000
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const { features: f, tipo: t, ts } = JSON.parse(cached)
        if (Date.now() - ts < CACHE_TTL) { setActiveFeatures(f); if (t) setTenantTipo(t); return }
      }
    } catch {}
    fetch('/api/features', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.features) {
          setActiveFeatures(d.features)
          if (d?.tipo) setTenantTipo(d.tipo)
          try { localStorage.setItem(CACHE_KEY, JSON.stringify({ features: d.features, tipo: d.tipo, ts: Date.now() })) } catch {}
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setOpen(false)
    setOpenGroups(prev => {
      const next = { ...prev }
      groups.forEach(g => {
        if (g.items.some(i => i.exact ? pathname === i.href : pathname.startsWith(i.href))) {
          next[g.label] = true
        }
      })
      return next
    })
  }, [pathname, groups])

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  const currentLabel = groups.flatMap(g => g.items).find(i => isActive(i.href, i.exact))?.label || 'Dashboard'

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }



  const sidebarJSX = (
    <div
      className="flex flex-col h-full overflow-hidden bg-white dark:bg-gradient-to-b dark:from-[#0c0c1e] dark:to-[#08080f] border-r border-slate-200 dark:border-slate-800/60"
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-slate-100 dark:border-slate-800/60 shrink-0 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #14B8A6, #0F766E)' }}>
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        {!collapsed && (
          <div>
            <span
              className="font-bold text-lg tracking-tight leading-none block"
              style={{
                background: 'linear-gradient(90deg, #0F766E, #0284C7)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              ConectaAI
            </span>
            <span className="text-slate-400 dark:text-slate-500 text-xs">Condominios</span>
          </div>
        )}
      </div>

      {/* Selector Condominio — hidden for superadmin */}
      {!collapsed && user?.rol !== 'superadmin' && (
        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/60">
          <CondominioSelector />
        </div>
      )}
      {!collapsed && user?.rol === 'superadmin' && (
        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/60 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-500"></div>
          <span className="text-xs font-semibold text-accent-600 dark:text-accent-400">Super Admin</span>
        </div>
      )}

      {/* Buscador — con 70+ atajos en el menu, encontrar uno a golpe de vista no es realista */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-1 shrink-0">
          <div className="relative">
            <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              value={navSearch}
              onChange={e => setNavSearch(e.target.value)}
              placeholder="Buscar en el menu..."
              className="w-full pl-8 pr-2 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-400 dark:text-slate-200"
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
        {groups.filter(g => !g.superadminOnly || user?.rol === 'superadmin').map(group => {
          const visibleItems = group.items.filter(i =>
            (!i.featureKey || hasFeature(i.featureKey)) &&
            (!navSearch || i.label.toLowerCase().includes(navSearch.toLowerCase()))
          )
          if (visibleItems.length === 0) return null
          const isOpen = collapsed || !!navSearch || openGroups[group.label]
          const hasActive = visibleItems.some(i => isActive(i.href, i.exact))
          return (
            <div key={group.label}>
              {!collapsed && (
                <button
                  onClick={() => setOpenGroups(p => ({ ...p, [group.label]: !p[group.label] }))}
                  className="w-full flex items-center gap-2 px-2 py-1 mb-0.5 rounded-md group/gh hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <p className={`flex-1 text-left text-[10px] font-bold uppercase tracking-[1.5px] whitespace-nowrap transition-colors ${hasActive ? 'text-brand-600 dark:text-brand-400' : group.superadminOnly ? 'text-accent-500 dark:text-accent-400' : 'text-slate-400 dark:text-slate-500 group-hover/gh:text-slate-600 dark:group-hover/gh:text-slate-300'}`}>
                    {group.label}
                  </p>
                  <svg
                    className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 text-slate-400 dark:text-slate-600 ${openGroups[group.label] || navSearch ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
              {isOpen && (
                <div className="space-y-0.5">
                  {visibleItems.map(item => {
                    const active = isActive(item.href, item.exact)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150
                          ${active
                            ? 'bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 font-semibold'
                            : 'text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}
                          ${collapsed ? 'justify-center' : ''}`}
                      >
                        <NavIcon d={item.icon} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="shrink-0 border-t border-slate-100 dark:border-slate-800/60 p-3">
        {!collapsed && user && (
          <div className="flex items-center gap-3 px-3 py-3 mb-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #14B8A6, #0F766E)' }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-900 dark:text-white text-xs font-semibold truncate">{user.nombre_completo}</p>
              <p className="text-slate-500 dark:text-slate-400 text-xs truncate capitalize">{user.rol}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed((c: boolean) => !c)}
          className="hidden lg:flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-colors duration-150"
          title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={collapsed ? 'M13 5l7 7-7 7M5 5l7 7-7 7' : 'M11 19l-7-7 7-7m8 14l-7-7 7-7'} />
          </svg>
          {!collapsed && <span>Colapsar</span>}
        </button>
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-150 ${collapsed ? 'justify-center' : ''}`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!collapsed && <span>Cerrar sesion</span>}
        </button>
      </div>
    </div>
  )

  return (
    <ToastProvider>
      <div className="flex h-screen bg-slate-50 dark:bg-[#080812] overflow-hidden">
        {open && (
          <div className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm" onClick={() => setOpen(false)} />
        )}

        <aside className={`fixed inset-y-0 left-0 z-30 transform transition-all duration-200 ease-in-out lg:relative lg:translate-x-0 lg:flex lg:flex-col ${open ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'w-16' : 'w-64'}`}>
          {sidebarJSX}
        </aside>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="shrink-0 z-10 h-14 flex items-center bg-white/95 dark:bg-[rgba(8,8,18,0.95)] backdrop-blur-md border-b border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-3 px-4 sm:px-5 w-full h-full">
              <button
                onClick={() => setOpen(true)}
                className="lg:hidden p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div className="flex items-center gap-2 text-sm min-w-0 flex-1">
                <span
                  className="font-bold hidden sm:block"
                  style={{
                    background: 'linear-gradient(90deg, #0F766E, #0284C7)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  ConectaAI
                </span>
                <span className="hidden sm:block text-slate-300 dark:text-slate-600">/</span>
                <span className="truncate text-slate-500 dark:text-slate-400 text-sm">{currentLabel}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <CondominioAvatar />
                <MorosidadBadge />

                <a
                  href="/portal"
                  target="_blank"
                  className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-brand-700 dark:text-brand-400 px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/30 hover:bg-brand-100 dark:hover:bg-brand-500/20 transition-colors duration-150"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Portal
                </a>

                <Link
                  href="/dashboard/condominios/ia-chat"
                  className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-accent-700 dark:text-accent-400 px-3 py-1.5 rounded-lg bg-accent-50 dark:bg-accent-500/10 border border-accent-200 dark:border-accent-500/30 hover:bg-accent-100 dark:hover:bg-accent-500/20 transition-colors duration-150"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                  IA
                </Link>
                <button
                  onClick={toggleDark}
                  className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors duration-150"
                  title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                >
                  {isDark ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                </button>

                <BellDropdown />

                <ProfileDropdown user={user} onLogout={handleLogout} />
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#020617]">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
