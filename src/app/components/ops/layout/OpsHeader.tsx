import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useOpsStore } from '@/services/opsState';
import { formatWeekDate, getMonday } from '@/types/ops';
import { VolunteerPicker } from '../widgets/VolunteerPicker';
import { WeekBadge } from '../widgets/WeekBadge';

/**
 * Top header for Ops Hub with breadcrumbs and volunteer picker
 */
export const OpsHeader: React.FC = () => {
  const location = useLocation();
  const { selectedWeek, setSelectedWeek } = useOpsStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check if viewing current week
  const currentMonday = getMonday(new Date()).toISOString().split('T')[0];
  const isCurrentWeek = selectedWeek === currentMonday;

  // Week navigation handlers
  const handlePrevWeek = () => {
    const current = new Date(selectedWeek);
    current.setDate(current.getDate() - 7);
    setSelectedWeek(getMonday(current).toISOString().split('T')[0]);
  };

  const handleNextWeek = () => {
    const current = new Date(selectedWeek);
    current.setDate(current.getDate() + 7);
    setSelectedWeek(getMonday(current).toISOString().split('T')[0]);
  };

  const handleThisWeek = () => {
    setSelectedWeek(currentMonday);
  };

  // Show week badge on schedule-related pages
  const showWeekBadge = ['/ops/overview', '/ops/schedule', '/ops/action-items'].some(
    path => location.pathname.startsWith(path)
  ) || location.pathname.includes('/ops/volunteer/');

  // Generate breadcrumbs from path
  const getBreadcrumbs = () => {
    const parts = location.pathname.split('/').filter(Boolean);
    const crumbs: { label: string; path: string }[] = [];

    if (parts[0] === 'ops') {
      crumbs.push({ label: 'Ops Hub', path: '/ops' });

      if (parts[1] === 'guide') {
        crumbs.push({ label: 'Knowledge Base', path: '/ops/guide' });
        if (parts[2]) {
          // Article slug - format for display
          const articleName = parts[2]
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          crumbs.push({ label: articleName, path: location.pathname });
        }
      } else if (parts[1] === 'overview') {
        crumbs.push({ label: 'Schedule Overview', path: '/ops/overview' });
      } else if (parts[1] === 'volunteer' && parts[2]) {
        crumbs.push({ label: 'Volunteer', path: '/ops/overview' });
        const volunteerName = parts[2].charAt(0).toUpperCase() + parts[2].slice(1);
        crumbs.push({ label: volunteerName, path: location.pathname });
      } else if (parts[1] === 'schedule') {
        crumbs.push({ label: 'Schedule Management', path: '/ops/schedule' });
      } else if (parts[1] === 'action-items') {
        crumbs.push({ label: 'Action Items', path: '/ops/action-items' });
      }
    }

    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between h-16">
        {/* Left: Mobile menu + Breadcrumbs */}
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-sm">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.path}>
                {idx > 0 && <span className="text-slate-300">/</span>}
                {idx === breadcrumbs.length - 1 ? (
                  <span className="font-medium text-slate-900">{crumb.label}</span>
                ) : (
                  <Link
                    to={crumb.path}
                    className="text-slate-500 hover:text-emerald-600 transition-colors"
                  >
                    {crumb.label}
                  </Link>
                )}
              </React.Fragment>
            ))}
          </nav>
        </div>

        {/* Center/Right: Week badge + Volunteer picker */}
        <div className="flex items-center gap-4">
          {showWeekBadge && (
            <WeekBadge weekDate={selectedWeek} className="hidden sm:flex" />
          )}
          <VolunteerPicker />
        </div>
      </div>

      {/* Mobile week navigation - shows on schedule-related pages */}
      {showWeekBadge && (
        <div className="lg:hidden flex items-center justify-between py-2 border-t border-slate-100 -mx-4 px-4 bg-slate-50/50">
          <button
            onClick={handlePrevWeek}
            className="p-2 -ml-2 rounded-lg hover:bg-slate-200/70 text-slate-600 transition-colors"
            aria-label="Previous week"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <span className={cn(
              'text-sm font-medium',
              isCurrentWeek ? 'text-emerald-700' : 'text-slate-700'
            )}>
              Week of {formatWeekDate(selectedWeek)}
            </span>
            {!isCurrentWeek && (
              <button
                onClick={handleThisWeek}
                className="block mx-auto text-xs text-emerald-600 hover:text-emerald-700 mt-0.5"
              >
                Go to this week
              </button>
            )}
          </div>

          <button
            onClick={handleNextWeek}
            className="p-2 -mr-2 rounded-lg hover:bg-slate-200/70 text-slate-600 transition-colors"
            aria-label="Next week"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Mobile dropdown - simplified since bottom nav handles main navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-100 py-3 space-y-1">
          {/* Action Items - coordinator feature not in bottom nav */}
          <MobileNavLink to="/ops/action-items" onClick={() => setMobileMenuOpen(false)}>
            ✅ Action Items
          </MobileNavLink>
          {/* Back to main tracker */}
          <a
            href="/"
            className="block px-3 py-2 text-sm text-slate-500 hover:text-emerald-600 hover:bg-slate-50 rounded-lg"
          >
            ← Back to Tracker
          </a>
        </div>
      )}
    </div>
  );
};

const MobileNavLink: React.FC<{
  to: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ to, onClick, children }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        'block px-3 py-2 rounded-lg text-sm font-medium',
        isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'
      )}
    >
      {children}
    </Link>
  );
};
