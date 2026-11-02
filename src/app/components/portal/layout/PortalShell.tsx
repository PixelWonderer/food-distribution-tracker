import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePortalStore } from '@/services/portalState';
import LogTouchModal from '../LogTouchModal';
import PersonDrawer from '../PersonDrawer';

// ─── Nav items ────────────────────────────────────────────────────────────────

interface ActiveNavItem {
  path: string;
  label: string;
  disabled: false;
  exact: boolean;
}
interface DisabledNavItem {
  path: string;
  label: string;
  disabled: true;
}
type NavItem = ActiveNavItem | DisabledNavItem;

const NAV_ITEMS: NavItem[] = [
  { path: '/portal', label: 'Today', disabled: false, exact: true },
  { path: '/portal/roster', label: 'Roster', disabled: false, exact: false },
  { path: '/portal/pipeline', label: 'Pipeline', disabled: false, exact: false },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Shell ────────────────────────────────────────────────────────────────────

const PortalShell: React.FC = () => {
  const { fetchAll, loading, logTouchOpen, closeLogTouchModal, logTouchPrefill, logTouch } =
    usePortalStore();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const isActive = (item: ActiveNavItem): boolean => {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  };

  // Nav link class — kicker style: small, uppercase, tracked
  const navLinkClass = (active: boolean) =>
    cn(
      'font-body text-[11px] font-semibold uppercase tracking-[0.16em] px-2.5 py-1 transition-colors',
      active ? 'bg-ink text-paper' : 'text-ink/60 hover:text-ink',
    );

  const renderDesktopItem = (item: NavItem) => {
    if (item.disabled) {
      return (
        <span
          key={item.path}
          className="font-body text-[11px] font-semibold uppercase tracking-[0.16em] px-2.5 py-1 text-ink/30 cursor-not-allowed select-none"
        >
          {item.label}
        </span>
      );
    }
    const active = isActive(item);
    return (
      <NavLink key={item.path} to={item.path} end={item.exact} className={navLinkClass(active)}>
        {item.label}
      </NavLink>
    );
  };

  const renderDrawerItem = (item: NavItem) => {
    if (item.disabled) {
      return (
        <span
          key={item.path}
          className="block py-3 px-4 font-body text-[13px] font-semibold uppercase tracking-[0.16em] text-ink/30 border-b border-ink/10 cursor-not-allowed"
        >
          {item.label}
        </span>
      );
    }
    const active = isActive(item);
    return (
      <NavLink
        key={item.path}
        to={item.path}
        end={item.exact}
        className={cn(
          'block py-3 px-4 font-body text-[13px] font-semibold uppercase tracking-[0.16em] border-b border-ink/10 transition-colors',
          active ? 'bg-ink text-paper' : 'text-ink/70 hover:text-ink',
        )}
        onClick={() => setDrawerOpen(false)}
      >
        {item.label}
      </NavLink>
    );
  };

  return (
    <div className="min-h-screen bg-paper">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-paper border-b border-ink/15 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          {/* Title */}
          <span className="font-display font-bold text-[16px] text-ink tracking-tight shrink-0">
            Community Portal
          </span>

          {/* Desktop nav — center */}
          <nav className="hidden sm:flex items-center gap-1 flex-1">
            {NAV_ITEMS.map(renderDesktopItem)}
          </nav>

          {/* Right: date + loading dot */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <span className="hidden sm:block font-body text-[13px] text-ink/55">
              {formatDateShort(new Date())}
            </span>
            {loading && (
              <span
                className="w-2 h-2 rounded-full bg-amberPortal animate-pulse"
                title="Loading…"
              />
            )}
            {/* Hamburger — mobile only */}
            <button
              className="sm:hidden p-1 text-ink/60 hover:text-ink"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile nav drawer ──────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-ink/30"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer panel */}
          <div className="relative ml-auto w-56 bg-paper border-l border-ink/15 flex flex-col h-full shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-ink/15">
              <span className="font-display font-bold text-[14px] text-ink">Menu</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-ink/50 hover:text-ink"
                aria-label="Close navigation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1">{NAV_ITEMS.map(renderDrawerItem)}</nav>
          </div>
        </div>
      )}

      {/* ── Page content ───────────────────────────────────────────────────── */}
      <main className="bg-paper">
        <Outlet />
      </main>

      {/* ── LogTouchModal — rendered here so it's always available ─────────── */}
      {logTouchOpen && (
        <LogTouchModal
          open={logTouchOpen}
          onClose={closeLogTouchModal}
          prefill={logTouchPrefill ?? undefined}
          onLogTouch={logTouch}
        />
      )}

      {/* ── PersonDrawer placeholder ────────────────────────────────────────── */}
      <PersonDrawer />
    </div>
  );
};

export default PortalShell;
