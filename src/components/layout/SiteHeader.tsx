'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const PRIMARY_NAV: NavItem[] = [
  { href: '/', label: '地圖', icon: '🗺' },
  { href: '/route', label: '雨天路徑', icon: '🚶' },
  { href: '/forecast', label: '水災預警', icon: '⚠' },
  { href: '/me', label: '我的', icon: '👤' },
];

const SECONDARY_NAV: NavItem[] = [
  { href: '/dashboard', label: '儀表板', icon: '📊' },
  { href: '/admin', label: '管理', icon: '⚙' },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4">
        {/* Logo + 標題 */}
        <Link
          href="/"
          className="group flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm transition-transform group-hover:scale-105">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="currentColor"
              aria-hidden
            >
              <path d="M12 2.5c-1 1.4-5.5 7.4-5.5 11.5a5.5 5.5 0 1 0 11 0c0-4.1-4.5-10.1-5.5-11.5z" />
            </svg>
          </span>
          <div className="hidden leading-tight sm:block">
            <p className="text-[14px] font-semibold tracking-tight text-slate-900">
              台大水資源地圖
            </p>
            <p className="text-[10.5px] text-slate-500">NTU Water Risk Map</p>
          </div>
        </Link>

        {/* Primary nav — 主要 daily 用 */}
        <nav className="ml-auto flex items-center gap-0.5 overflow-x-auto">
          {PRIMARY_NAV.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
            />
          ))}
        </nav>

        {/* Secondary nav — desktop only，較少用 */}
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
  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-1 rounded-lg px-3 py-1.5 text-[13px] font-medium',
        'transition-all duration-150 ease-soft-out',
        active
          ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-100'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        compact && 'px-2.5',
      )}
    >
      <span className="text-[13px]" aria-hidden>
        {item.icon}
      </span>
      <span>{item.label}</span>
    </Link>
  );
}
