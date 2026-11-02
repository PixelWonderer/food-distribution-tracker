import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '@/services/state';

const PAGE_TITLES: Record<string, { title: string; description: string }> = {
  '/admin': {
    title: 'Dashboard',
    description: 'Weekly schedule overview and quick actions',
  },
  '/admin/destinations': {
    title: 'Destination Management',
    description: 'Edit timings, reorder destinations, bulk updates',
  },
  '/admin/shift-tasks': {
    title: 'Shift Tasks',
    description: 'Recurring shift reminders for volunteers',
  },
  '/admin/partner-split': {
    title: 'Partner Distribution',
    description: 'Split Partner Group 6 items to days and other destinations (Partner 11, Partner 10)',
  },
};

export const AdminHeader: React.FC = () => {
  const location = useLocation();
  const isSyncing = useAppStore((s) => s.isSyncing);
  const isOnline = useAppStore((s) => s.isOnline);
  const lastSyncTime = useAppStore((s) => s.lastSyncTime);

  const pageInfo = PAGE_TITLES[location.pathname] || PAGE_TITLES['/admin'];

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    const diff = Date.now() - lastSyncTime;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{pageInfo.title}</h1>
        <p className="text-sm text-slate-500">{pageInfo.description}</p>
      </div>

      <div className="flex items-center gap-4">
        {/* Keyboard shortcuts hint */}
        <button
          className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1.5 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 transition-colors"
          onClick={() => {
            // Will implement keyboard shortcuts modal later
            alert('Keyboard shortcuts:\n\nj/k - Navigate rows\nx - Toggle selection\nShift+A - Select all\nEscape - Clear selection\ne - Edit row\nb - Bulk edit');
          }}
        >
          <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono">?</kbd>
          <span>Shortcuts</span>
        </button>

        {/* Sync status */}
        <div className="flex items-center gap-2 text-sm">
          {isSyncing ? (
            <>
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-amber-600">Syncing...</span>
            </>
          ) : isOnline ? (
            <>
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-slate-500">Synced {formatLastSync()}</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-red-600">Offline</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminHeader;
