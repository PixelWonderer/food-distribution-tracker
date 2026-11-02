import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/services/state';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  description?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    path: '/admin',
    label: 'Dashboard',
    icon: '📊',
    description: 'Schedule overview',
  },
  {
    path: '/admin/destinations',
    label: 'Destinations',
    icon: '📍',
    description: 'Manage timing & order',
  },
  {
    path: '/admin/shift-tasks',
    label: 'Shift Tasks',
    icon: '📋',
    description: 'Recurring shift reminders',
  },
  {
    path: '/admin/partner-split',
    label: 'Partner Distribution',
    icon: '📦',
    description: 'Split items to recipients',
  },
];

export const AdminSidebar: React.FC = () => {
  const location = useLocation();
  const volunteerName = useAppStore((s) => s.preferences.volunteerName);
  const role = useAppStore((s) => s.preferences.role);

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin' || location.pathname === '/admin/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-slate-200 p-4">
        <Link to="/" className="flex items-center gap-2 text-slate-600 hover:text-emerald-600 transition-colors text-sm mb-3">
          <span>←</span>
          <span>Back to Tracker</span>
        </Link>
        <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <span>⚙️</span> Admin Tools
        </h1>
        <p className="text-xs text-slate-500 mt-1">Desktop management console</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
              'hover:bg-slate-100',
              isActive(item.path)
                ? 'bg-emerald-50 text-emerald-700 font-medium'
                : 'text-slate-700'
            )}
          >
            <span className="text-lg">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{item.label}</div>
              {item.description && (
                <div className="text-xs text-slate-500 truncate">{item.description}</div>
              )}
            </div>
            {isActive(item.path) && (
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            )}
          </Link>
        ))}
      </nav>

      {/* User info footer */}
      <div className="border-t border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold text-sm">
            {volunteerName ? volunteerName.charAt(0).toUpperCase() : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-900 truncate">
              {volunteerName || 'Unknown User'}
            </div>
            <div className="text-xs text-slate-500">
              {role === 'fullAccess' ? 'Full Access' : 'Food Bank Coordinator'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSidebar;
