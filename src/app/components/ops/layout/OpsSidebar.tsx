import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useOpsStore } from '@/services/opsState';
import { KB_CATEGORY_INFO, type KBCategory } from '@/types/ops';

/**
 * Left sidebar navigation for Ops Hub
 */
export const OpsSidebar: React.FC = () => {
  const { currentVolunteer, volunteers } = useOpsStore();
  const location = useLocation();

  const navItems = [
    { path: '/ops/dashboard', label: 'Dashboard', icon: '🏠' },
    { path: '/ops/overview', label: 'Schedule Overview', icon: '📅' },
    { path: '/ops/guide', label: 'Knowledge Base', icon: '📚' },
    { path: '/ops/schedule', label: 'Manage Schedule', icon: '⚙️' },
    { path: '/ops/action-items', label: 'Action Items', icon: '✅' },
  ];

  // Category filters for knowledge base
  const categories: KBCategory[] = ['procedures', 'locations', 'routes', 'contacts'];

  return (
    <div className="flex flex-col h-full">
      {/* Logo / Branding */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🥕</span>
          <div>
            <h1 className="font-bold text-slate-900">Food Operations</h1>
            <p className="text-xs text-slate-500">Volunteer Hub</p>
          </div>
        </div>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        {/* Knowledge Base Categories */}
        {location.pathname.startsWith('/ops/guide') && (
          <div className="pt-4 mt-4 border-t border-slate-100">
            <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Categories
            </p>
            {categories.map(cat => (
              <NavLink
                key={cat}
                to={`/ops/guide?category=${cat}`}
                className={() =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                    location.search === `?category=${cat}`
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  )
                }
              >
                <span>{KB_CATEGORY_INFO[cat].icon}</span>
                {KB_CATEGORY_INFO[cat].name}
              </NavLink>
            ))}
          </div>
        )}

        {/* Volunteer Quick Links */}
        {volunteers.length > 0 && (
          <div className="pt-4 mt-4 border-t border-slate-100">
            <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Volunteer Views
            </p>
            {volunteers.slice(0, 6).map(vol => (
              <NavLink
                key={vol.id}
                to={`/ops/volunteer/${vol.slug}`}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700',
                    currentVolunteer?.slug === vol.slug && 'ring-1 ring-emerald-200'
                  )
                }
              >
                <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium">
                  {vol.display_name.charAt(0)}
                </span>
                {vol.display_name}
                {currentVolunteer?.slug === vol.slug && (
                  <span className="ml-auto text-emerald-600 text-xs">(you)</span>
                )}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* Bottom: Back to tracker link */}
      <div className="p-4 border-t border-slate-100">
        <a
          href="/"
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-emerald-600 transition-colors"
        >
          <span>←</span>
          Back to Tracker
        </a>
      </div>
    </div>
  );
};
