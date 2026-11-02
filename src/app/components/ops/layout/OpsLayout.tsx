import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { OpsSidebar } from './OpsSidebar';
import { OpsHeader } from './OpsHeader';
import { MobileBottomNav } from './MobileBottomNav';
import { IdentityModal } from '../widgets/IdentityModal';
import { useOpsStore } from '@/services/opsState';

/**
 * Main layout for the Ops Hub - desktop-first with left sidebar
 */
const OpsLayout: React.FC = () => {
  const { fetchVolunteers, subscribeToShifts, subscribeToActionItems, unsubscribeAll } = useOpsStore();

  // Load volunteers and set up real-time subscriptions on mount
  useEffect(() => {
    fetchVolunteers();

    // Set up real-time subscriptions for collaborative updates
    subscribeToShifts();
    subscribeToActionItems();

    // Cleanup subscriptions on unmount
    return () => {
      unsubscribeAll();
    };
  }, [fetchVolunteers, subscribeToShifts, subscribeToActionItems, unsubscribeAll]);

  return (
    <div className="h-screen bg-slate-50 overflow-hidden">
      {/* First-visit identity modal */}
      <IdentityModal />

      {/* Sidebar - hidden on mobile, fixed on desktop */}
      <aside className="fixed left-0 top-0 z-30 h-full w-64 border-r border-slate-200 bg-white shadow-sm hidden lg:block overflow-y-auto">
        <OpsSidebar />
      </aside>

      {/* Main content area */}
      <div className="lg:ml-64 h-screen flex flex-col">
        {/* Sticky header */}
        <header className="flex-shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <OpsHeader />
        </header>

        {/* Page content - scrollable container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Extra bottom padding on mobile for bottom nav */}
          <div className="max-w-6xl mx-auto pb-20 lg:pb-8">
            <Outlet />
          </div>

          {/* Footer inside scrollable area - hidden on mobile */}
          <footer className="hidden lg:block border-t border-slate-200 bg-white py-4 px-6 text-center text-sm text-slate-500 mt-8">
            <a href="/" className="hover:text-emerald-600 transition-colors">
              ← Back to Food Tracker
            </a>
          </footer>
        </main>
      </div>

      {/* Mobile bottom navigation - visible only on mobile */}
      <MobileBottomNav />
    </div>
  );
};

export default OpsLayout;
