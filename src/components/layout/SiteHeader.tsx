'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Map as MapIcon,
  Footprints,
  AlertTriangle,
  User,
  BarChart3,
  Settings,
  Droplet,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const PRIMARY_NAV: NavItem[] = [
  { href: '/', label: '地圖', icon: MapIcon },
  { href: '/route', label: '雨天路徑', icon: Footprints },
  { href: '/forecast', label: '水災預警', icon: AlertTriangle },
  { href: '/me', label: '我的', icon: User },
];

const SECONDARY_NAV: NavItem[] = [
  { href: '/dashboard', label: '儀表板', icon: BarChart3 },
  { href: '/admin', label: '管理', icon: Settings },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4">
        {/* Logo */}
        <Link
          href="/"
          className="group flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm transition-transform group-hover:scale-105">
            <Droplet className="h-[18px] w-[18px]" strokeWidth={2.4} fill="currentColor" />
          </span>
          <div className="hidden leading-tight sm:block">
            <p className="text-[14px] font-semibold tracking-tight text-slate-900">
              台大水資源地圖
            </p>
            <p className="text-[10.5px] text-slate-500">NTU Water Risk Map</p>
          </div>
        </Link>

        {/* Primary nav */}
        <nav className="ml-auto flex items-center gap-0.5 overflow-x-auto">
          {PRIMARY_NAV.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
            />
          ))}
        </nav>

        {/* Secondary nav — desktop only */}
        <nav className="hidden items-center gap-0.5 border-l border-slate-200 pl-2 md:flex">
          {SECONDARY_NAV.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
              compact
            />
          ))}
        </nav>
      </div>
    </header>
  );
}

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

function NavLink({
  item,
  active,
  compact,
}: {
  item: NavItem;
  active: boolean;
  compact?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium',
        'transition-all duration-150 ease-soft-out',
        active
          ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-100'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        compact && 'px-2.5',
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
      <span>{item.label}</span>
    </Link>
  );
}
