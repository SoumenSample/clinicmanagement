'use client';

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  BadgeIndianRupee,
  Bell,
  Building2,
  ChevronDown,
  CircleUserRound,
  Clipboard,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  Shield,
  Stethoscope,
  Users,
  X,
} from 'lucide-react';
import { getAuthHeaders } from '@/lib/utils/tenant-client';

type StoredUser = {
  name?: string;
  role?: string;
} | null;

type TenantOption = {
  id: string;
  name: string;
  slug: string;
  status: string;
  logoUrl?: string;
};

type TenantBrand = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
} | null;

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
};

let cachedUserRaw = '';
let cachedUserSnapshot: StoredUser = null;

const primaryNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/billing', label: 'Billing', icon: BadgeIndianRupee },
];

const secondaryNavItems: NavItem[] = [
  { href: '/dashboard/doctors', label: 'Doctors', icon: Stethoscope },
  { href: '/dashboard/patients', label: 'Patients', icon: Users },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/super-admin', label: 'Super Admin', icon: Shield },
  { href: '/settings', label: 'Settings', icon: Settings2 },
];

const doctorNavItems: NavItem[] = [
  { href: '/doctor-dashboard?section=profile', label: 'Profile', icon: CircleUserRound },
  { href: '/doctor-dashboard?section=patients', label: 'Patients', icon: Users },
  { href: '/doctor-dashboard?section=prescriptions', label: 'Prescriptions', icon: Clipboard },
  { href: '/doctor-dashboard?section=reports', label: 'Reports', icon: Bell },
];

const patientNavItems: NavItem[] = [
  { href: '/patient-dashboard?section=profile', label: 'Profile', icon: CircleUserRound },
  { href: '/patient-dashboard?section=doctors', label: 'Doctors', icon: Stethoscope },
  { href: '/patient-dashboard?section=prescriptions', label: 'Prescriptions', icon: Clipboard },
  { href: '/patient-dashboard?section=reports', label: 'Reports', icon: Bell },
];

const publicRoutes = ['/login', '/register', '/verify'];

function getStoredUserSnapshot(): StoredUser {
  if (typeof window === 'undefined') {
    return null;
  }

  const userData = window.localStorage.getItem('user');
  if (!userData) {
    cachedUserRaw = '';
    cachedUserSnapshot = null;
    return null;
  }

  if (userData === cachedUserRaw) {
    return cachedUserSnapshot;
  }

  try {
    cachedUserRaw = userData;
    cachedUserSnapshot = JSON.parse(userData) as StoredUser;
    return cachedUserSnapshot;
  } catch {
    cachedUserRaw = '';
    cachedUserSnapshot = null;
    return null;
  }
}

function subscribeToStoredUser(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  return () => window.removeEventListener('storage', onStoreChange);
}

function isActiveRoute(pathname: string, href: string, activeSection: string) {
  const [baseHref, sectionQuery] = href.split('?section=');

  if (pathname !== baseHref && !pathname.startsWith(`${baseHref}/`)) {
    return false;
  }

  if (!sectionQuery) {
    return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
  }

  return activeSection === sectionQuery || (!activeSection && sectionQuery === 'profile');
}

function NavLink({ item, pathname, activeSection, onNavigate }: { item: NavItem; pathname: string; activeSection: string; onNavigate?: () => void }) {
  const active = isActiveRoute(pathname, item.href, activeSection);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
        active
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/10'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
      }`}
    >
      <Icon className={`h-4 w-4 ${active ? 'text-white' : 'text-slate-400'}`} />
      <span>{item.label}</span>
    </Link>
  );
}

export default function Navbar({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useSyncExternalStore(subscribeToStoredUser, getStoredUserSnapshot, () => null);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [activeTenantId, setActiveTenantId] = useState(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    return window.localStorage.getItem('activeTenantId') || '';
  });
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [tenantBrand, setTenantBrand] = useState<TenantBrand>(null);
  const searchParams = useSearchParams();
  const activeSection = searchParams.get('section') || 'profile';

  const isPublicPage = publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('activeTenantId');
    setIsMobileNavOpen(false);
    router.push('/login');
  };

  useEffect(() => {
    if (!user || user.role !== 'super_admin') {
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }

    const savedTenantId = localStorage.getItem('activeTenantId') || '';

    const loadTenants = async () => {
      try {
        setIsLoadingTenants(true);
        const response = await fetch('/api/tenants', {
          headers: getAuthHeaders(token),
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const items = Array.isArray(data) ? data : [];
        setTenants(items);

        if (!savedTenantId && items.length > 0) {
          const firstTenantId = items[0].id;
          localStorage.setItem('activeTenantId', firstTenantId);
          queueMicrotask(() => setActiveTenantId(firstTenantId));
        }
      } finally {
        setIsLoadingTenants(false);
      }
    };

    void loadTenants();
  }, [user]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) {
      setTenantBrand(null);
      return;
    }

    const storedActiveTenantId = localStorage.getItem('activeTenantId');
    if (user.role === 'super_admin' && !storedActiveTenantId) {
      setTenantBrand(null);
      return;
    }

    const loadTenantBrand = async () => {
      try {
        const response = await fetch('/api/tenant', {
          headers: getAuthHeaders(token),
        });

        if (!response.ok) {
          setTenantBrand(null);
          return;
        }

        const data = await response.json();
        const tenant = data?.tenant;
        if (tenant) {
          setTenantBrand({
            id: tenant._id?.toString?.() || tenant.id || '',
            name: tenant.name || 'ClinicManage',
            slug: tenant.slug || '',
            logoUrl: tenant.logoUrl || '',
          });
        } else {
          setTenantBrand(null);
        }
      } catch {
        setTenantBrand(null);
      }
    };

    void loadTenantBrand();
  }, [user, activeTenantId]);

  const handleTenantChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextTenantId = event.target.value;
    localStorage.setItem('activeTenantId', nextTenantId);
    setActiveTenantId(nextTenantId);
    window.location.reload();
  };

  const brandTitle = tenantBrand?.name || 'ClinicManage';
  const brandSubtitle = '';
  // const brandSubtitle = tenantBrand?.slug ? tenantBrand.slug : 'Clinic control center';
  const isClinicalPortal = user?.role === 'doctor' || user?.role === 'patient';
  const clinicalNavItems = user?.role === 'doctor' ? doctorNavItems : patientNavItems;

  const BrandMark = ({ className = 'flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm' }: { className?: string }) => {
    if (tenantBrand?.logoUrl) {
      return (
        <span className={className}>
          <img src={tenantBrand.logoUrl} alt={`${brandTitle} logo`} className="h-full w-full rounded-2xl object-cover" />
        </span>
      );
    }

    return (
      <span className={className}>
        <Building2 className="h-5 w-5" />
      </span>
    );
  };

  if (isPublicPage) {
    return (
      <div className="min-h-screen">
        <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <Link href="/dashboard" className="flex items-center gap-3 text-lg font-semibold tracking-tight text-slate-950">
              <BrandMark className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm" />
              <span className="flex flex-col leading-tight">
                {brandTitle}
                <span className="text-xs font-normal text-slate-500">{brandSubtitle}</span>
              </span>
            </Link>

            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 sm:block">
                  {user.name} <span className="text-slate-500">({user.role})</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    );
  }

  const allowedManagementItems = secondaryNavItems.filter((item) => {
    if (item.href === '/super-admin') {
      return user?.role === 'super_admin';
    }

    if (item.href === '/users') {
      return ['admin', 'owner', 'super_admin'].includes(user?.role || '');
    }

    return true;
  });

  return (
    <div className="min-h-screen lg:flex lg:items-start">
      <aside className="hidden h-screen w-80 shrink-0 border-r border-slate-200/80 bg-white/90 backdrop-blur-xl lg:sticky lg:top-0 lg:flex lg:flex-col">
        <div className="border-b border-slate-200/80 px-6 py-5">
          <Link href="/dashboard" className="flex items-center gap-3 text-lg font-semibold tracking-tight text-slate-950">
            <BrandMark className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm" />
            <span className="flex flex-col leading-tight">
              {brandTitle}
              <span className="text-xs font-normal text-slate-500">{brandSubtitle}</span>
            </span>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 pb-28">
          {user?.role === 'super_admin' && (
            <div className="mb-5 rounded-3xl border border-blue-100 bg-blue-50/60 p-4">
              {/* <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                <Shield className="h-4 w-4" />
                Store context
              </div> */}
              <label className="block text-sm font-medium text-slate-700">Selected Clinic
                <div className="mt-2 flex items-center gap-2 rounded-2xl border border-blue-100 bg-white px-3 py-2 shadow-sm">
                  <select
                    value={activeTenantId}
                    onChange={handleTenantChange}
                    disabled={isLoadingTenants}
                    className="w-full bg-transparent text-sm text-slate-800 outline-none"
                  >
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </div>
              </label>
            </div>
          )}

          <nav className="space-y-6">
            {isClinicalPortal ? (
              <div>
                <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Portal</p>
                <div className="mt-3 space-y-1.5">
                  {clinicalNavItems.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} activeSection={activeSection} />
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div>
                  <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Main</p>
                  <div className="mt-3 space-y-1.5">
                    {primaryNavItems.map((item) => (
                      <NavLink key={item.href} item={item} pathname={pathname} activeSection={activeSection} />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Management</p>
                  <div className="mt-3 space-y-1.5">
                    {allowedManagementItems.map((item) => (
                      <NavLink key={item.href} item={item} pathname={pathname} activeSection={activeSection} />
                    ))}
                  </div>
                </div>
              </>
            )}
          </nav>
        </div>

        <div className="sticky bottom-0 border-t border-slate-200/80 bg-white/95 p-4 backdrop-blur">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <CircleUserRound className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-950">{user?.name || 'Signed in user'}</p>
                <p className="truncate text-xs text-slate-500">{user?.role || 'member'}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <button
              onClick={() => setIsMobileNavOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Link href="/dashboard" className="flex items-center gap-2 text-base font-semibold tracking-tight text-slate-950">
              <BrandMark className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm" />
              <span className="flex flex-col leading-tight">
                {brandTitle}
                <span className="text-[11px] font-normal text-slate-500">{brandSubtitle}</span>
              </span>
            </Link>

            <button
              onClick={handleLogout}
              className="rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 min-w-0">
          <div className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>

      <div
        className={`fixed inset-0 z-50 lg:hidden ${isMobileNavOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!isMobileNavOpen}
      >
        <button
          type="button"
          onClick={() => setIsMobileNavOpen(false)}
          className={`absolute inset-0 bg-slate-950/45 transition-opacity ${
            isMobileNavOpen ? 'opacity-100' : 'opacity-0'
          }`}
          aria-label="Close navigation overlay"
        />

        <aside
          className={`absolute left-0 top-0 flex h-full w-[88vw] max-w-sm flex-col border-r border-slate-200 bg-white shadow-2xl transition-transform duration-200 ${
            isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <Link href="/dashboard" className="flex items-center gap-3 text-lg font-semibold tracking-tight text-slate-950" onClick={() => setIsMobileNavOpen(false)}>
              <BrandMark className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm" />
              <span className="flex flex-col leading-tight">
                {brandTitle}
                <span className="text-xs font-normal text-slate-500">{brandSubtitle}</span>
              </span>
            </Link>

            <button
              onClick={() => setIsMobileNavOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-600"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {user?.role === 'super_admin' && (
              <div className="mb-5 rounded-3xl border border-blue-100 bg-blue-50/60 p-4">
                {/* <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                  <Shield className="h-4 w-4" />
                  Store context
                </div> */}
                <label className="block text-sm font-medium text-slate-700">Selected Clinic
                  <div className="mt-2 flex items-center gap-2 rounded-2xl border border-blue-100 bg-white px-3 py-2 shadow-sm">
                    <select
                      value={activeTenantId}
                      onChange={handleTenantChange}
                      disabled={isLoadingTenants}
                      className="w-full bg-transparent text-sm text-slate-800 outline-none"
                    >
                      {tenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </div>
                </label>
              </div>
            )}

            <nav className="space-y-6">
              {isClinicalPortal ? (
                <div>
                  <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Portal</p>
                  <div className="mt-3 space-y-1.5">
                    {clinicalNavItems.map((item) => (
                      <NavLink key={item.href} item={item} pathname={pathname} activeSection={activeSection} onNavigate={() => setIsMobileNavOpen(false)} />
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Main</p>
                    <div className="mt-3 space-y-1.5">
                      {primaryNavItems.map((item) => (
                        <NavLink key={item.href} item={item} pathname={pathname} activeSection={activeSection} onNavigate={() => setIsMobileNavOpen(false)} />
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Management</p>
                    <div className="mt-3 space-y-1.5">
                      {allowedManagementItems.map((item) => (
                        <NavLink key={item.href} item={item} pathname={pathname} activeSection={activeSection} onNavigate={() => setIsMobileNavOpen(false)} />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </nav>
          </div>

          <div className="border-t border-slate-200 p-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <CircleUserRound className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-950">{user?.name || 'Signed in user'}</p>
                  <p className="truncate text-xs text-slate-500">{user?.role || 'member'}</p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}