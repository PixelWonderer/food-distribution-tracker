import React from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/services/state';

/**
 * Access guard for admin routes - only allows foodBank and fullAccess roles.
 * Shows an access denied page for other roles or when no role is set.
 */
export const AdminAccessGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const role = useAppStore((s) => s.preferences.role);

  const hasAccess = role === 'foodBank' || role === 'fullAccess';

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <span className="text-6xl block mb-4">🔒</span>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Restricted</h1>
          <p className="text-slate-600 mb-6">
            The Admin tools are only available to Food Bank Coordinator and Full Access users.
            {!role && (
              <span className="block mt-2 text-sm">
                Please set up your role in the tracker first.
              </span>
            )}
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <span>←</span> Back to Tracker
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminAccessGuard;
