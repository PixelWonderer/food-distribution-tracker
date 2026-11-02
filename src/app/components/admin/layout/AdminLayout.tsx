import React from 'react';
import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';
import { MobileBlocker } from './MobileBlocker';
import { AdminAccessGuard } from './AdminAccessGuard';

/**
 * Main layout for the Admin tools - desktop-first with left sidebar.
 * Blocks mobile users and restricts access to admin roles only.
 */
const AdminLayout: React.FC = () => {
  return (
    <AdminAccessGuard>
      <div className="h-screen bg-slate-50 overflow-hidden">
        {/* Mobile blocker overlay */}
        <MobileBlocker />

        {/* Sidebar - fixed on left */}
        <aside className="fixed left-0 top-0 z-30 h-full w-64 border-r border-slate-200 bg-white shadow-sm overflow-y-auto">
          <AdminSidebar />
        </aside>

        {/* Main content area */}
        <div className="ml-64 h-screen flex flex-col">
          {/* Sticky header */}
          <header className="flex-shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <AdminHeader />
          </header>

          {/* Page content - scrollable container */}
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </AdminAccessGuard>
  );
};

export default AdminLayout;
