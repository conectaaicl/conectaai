'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/hooks/useSession';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

// ---------------------------------------------------------------------------
// Icons (inline SVG — no external dep)
// ---------------------------------------------------------------------------
const Icon = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);

const ICONS = {
  home:       'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  users:      'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
  package:    'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 3L2 7l10 4 10-4-10-4z M2 17l10 4 10-4',
  car:        'M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v9a2 2 0 01-2 2h-2 M9 17a2 2 0 100 4 2 2 0 000-4z M15 17a2 2 0 100 4 2 2 0 000-4z',
  alert:      'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01',
  calendar:   'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  bell:       'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0',
  lock:       'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z M7 11V7a5 5 0 0110 0v4',
  camera:     'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z M12 17a4 4 0 100-8 4 4 0 000 8',
  zap:        'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  creditcard: 'M1 4h22v16H1z M1 10h22',
  wifi:       'M5 12.55a11 11 0 0114.08 0 M1.42 9a16 16 0 0121.16 0 M8.53 16.11a6 6 0 016.95 0 M12 20h.01',
  logout:     'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9',
  menu:       'M3 12h18 M3 6h18 M3 18h18',
  x:          'M18 6L6 18 M6 6l12 12',
  building:   'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  shield:     'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  qrcode:     'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h.01 M17 14h.01 M20 14h.01 M14 17h.01 M17 17h.01 M20 17h.01 M14 20h.01 M17 20h.01 M20 20h.01',
  network:    'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18',
};

// ---------------------------------------------------------------------------
// Nav structure
// ---------------------------------------------------------------------------
const NAV_GROUPS: NavGroup[] = [
  {
    group: 'Principal',
    items: [
      { label: 'Central', href: '/dashboard/conserje/central', icon: <Icon d={ICONS.home} /> },
    ],
  },
  {
    group: 'Operaciones',
    items: [
      { label: 'Visitas',          href: '/dashboard/conserje/visitas',          icon: <Icon d={ICONS.users} /> },
      { label: 'Paquetería',       href: '/dashboard/conserje/paqueteria',       icon: <Icon d={ICONS.package} /> },
      { label: 'Estacionamientos', href: '/dashboard/conserje/estacionamientos', icon: <Icon d={ICONS.car} /> },
      { label: 'Incidencias',      href: '/dashboard/conserje/incidencias',      icon: <Icon d={ICONS.alert} /> },
    ],
  },
  {
    group: 'Residentes',
    items: [
      { label: 'Residentes', href: '/dashboard/conserje/residentes', icon: <Icon d={ICONS.users} /> },
      { label: 'Reservas',   href: '/dashboard/conserje/reservas',   icon: <Icon d={ICONS.calendar} /> },
      { label: 'Avisos',     href: '/dashboard/conserje/avisos',     icon: <Icon d={ICONS.bell} /> },
    ],
  },
  {
    group: 'Seguridad',
    items: [
      { label: 'Puertas',     href: '/dashboard/conserje/puertas',     icon: <Icon d={ICONS.lock} /> },
      { label: 'Cámaras',     href: '/dashboard/conserje/camaras',     icon: <Icon d={ICONS.camera} /> },
      { label: 'Alarmas',     href: '/dashboard/conserje/alarmas',     icon: <Icon d={ICONS.zap} /> },
      { label: 'RFID',        href: '/dashboard/conserje/rfid',        icon: <Icon d={ICONS.creditcard} /> },
      { label: 'Accesos QR',  href: '/dashboard/conserje/accesos-qr',  icon: <Icon d={ICONS.qrcode} /> },
    ],
  },
  {
    group: 'Sistema',
    items: [
      { label: 'Conexiones TCP/IP', href: '/dashboard/conserje/conexiones', icon: <Icon d={ICONS.network} /> },
    ],
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ConserjeLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // best-effort
    }
    router.push('/login');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Cargando sesión…</p>
        </div>
      </div>
    );
  }

  const NavLink = ({ item }: { item: NavItem }) => {
    const active = pathname === item.href || pathname.startsWith(item.href + '/');
    return (
      <Link
        href={item.href}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          active
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <span className={active ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
        {item.label}
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo / brand */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-slate-200">
        <span className="text-2xl" aria-hidden>🏢</span>
        <div>
          <p className="font-bold text-slate-900 leading-tight">Conserjería</p>
          <p className="text-xs text-slate-400">Sistema de control</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.group}>
            <p className="px-3 mb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {group.group}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User badge */}
      <div className="px-4 py-4 border-t border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0">
            {user?.nombre_completo ? user.nombre_completo.charAt(0).toUpperCase() : 'C'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {user?.nombre_completo ?? 'Conserje'}
            </p>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
              <Icon d={ICONS.shield} size={10} />
              Conserje
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* ── TOP BAR ── */}
      <header className="flex-shrink-0 flex items-center justify-between h-14 px-4 bg-white border-b border-slate-200 z-30">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Abrir menú"
          >
            <Icon d={sidebarOpen ? ICONS.x : ICONS.menu} size={20} />
          </button>
          <span className="text-xl" aria-hidden>🏢</span>
          <h1 className="font-bold text-slate-900 text-base hidden sm:block">Conserjería</h1>
        </div>

        <div className="flex items-center gap-3">
          {user?.nombre_completo && (
            <span className="text-sm text-slate-600 hidden sm:block">
              Hola, <strong>{user.nombre_completo}</strong>
            </span>
          )}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
          >
            <Icon d={ICONS.logout} size={16} />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── MOBILE OVERLAY ── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        )}

        {/* ── SIDEBAR ── */}
        <aside
          className={`
            fixed top-14 left-0 bottom-0 z-20 w-64 bg-white border-r border-slate-200 overflow-y-auto
            transform transition-transform duration-200 ease-in-out
            lg:static lg:translate-x-0 lg:flex-shrink-0
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <SidebarContent />
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
