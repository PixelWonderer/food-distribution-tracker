import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { App as TrackerApp } from '../App';

// Lazy load Ops Hub components to keep initial bundle small
const OpsLayout = lazy(() => import('../components/ops/layout/OpsLayout'));
const DashboardView = lazy(() => import('../components/ops/views/DashboardView'));
const GuideView = lazy(() => import('../components/ops/views/GuideView'));
const ArticleView = lazy(() => import('../components/ops/views/ArticleView'));
const OverviewView = lazy(() => import('../components/ops/views/OverviewView'));
const VolunteerView = lazy(() => import('../components/ops/views/VolunteerView'));
const ScheduleView = lazy(() => import('../components/ops/views/ScheduleView'));
const ActionItemsView = lazy(() => import('../components/ops/views/ActionItemsView'));

// Lazy load Portal components
const PortalShell = lazy(() => import('../components/portal/layout/PortalShell'));
const TodayView = lazy(() => import('../components/portal/TodayView'));
const RosterView = lazy(() => import('../components/portal/RosterView'));
const PipelineView = lazy(() => import('../components/portal/PipelineView'));

// Lazy load Admin components (desktop-only)
const AdminLayout = lazy(() => import('../components/admin/layout/AdminLayout'));
const AdminDashboardView = lazy(() => import('../components/admin/views/AdminDashboardView'));
const DestinationManagementView = lazy(() => import('../components/admin/views/DestinationManagementView'));
const ShiftTasksView = lazy(() => import('../components/admin/views/ShiftTasksView'));
const PartnerSplitView = lazy(() => import('../components/admin/views/PartnerSplitView'));

// Loading fallback for lazy-loaded components
const OpsLoading: React.FC = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center">
    <div className="text-center">
      <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-slate-600">Loading Operations Hub...</p>
    </div>
  </div>
);

// Loading fallback for Admin
const AdminLoading: React.FC = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center">
    <div className="text-center">
      <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-slate-600">Loading Admin Tools...</p>
    </div>
  </div>
);

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Existing tracker at root */}
      <Route path="/" element={<TrackerApp />} />

      {/* Ops Hub routes */}
      <Route
        path="/ops"
        element={
          <Suspense fallback={<OpsLoading />}>
            <OpsLayout />
          </Suspense>
        }
      >
        {/* Default redirect to dashboard */}
        <Route index element={<Navigate to="/ops/dashboard" replace />} />

        {/* Dashboard - the new landing page */}
        <Route path="dashboard" element={<Suspense fallback={<OpsLoading />}><DashboardView /></Suspense>} />

        {/* Knowledge base */}
        <Route path="guide" element={<Suspense fallback={<OpsLoading />}><GuideView /></Suspense>} />
        <Route path="guide/:articleSlug" element={<Suspense fallback={<OpsLoading />}><ArticleView /></Suspense>} />

        {/* Schedule views */}
        <Route path="overview" element={<Suspense fallback={<OpsLoading />}><OverviewView /></Suspense>} />
        <Route path="volunteer/:slug" element={<Suspense fallback={<OpsLoading />}><VolunteerView /></Suspense>} />

        {/* Management views */}
        <Route path="schedule" element={<Suspense fallback={<OpsLoading />}><ScheduleView /></Suspense>} />
        <Route path="action-items" element={<Suspense fallback={<OpsLoading />}><ActionItemsView /></Suspense>} />
      </Route>

      {/* Admin routes (desktop-only, role-restricted) */}
      <Route
        path="/admin"
        element={
          <Suspense fallback={<AdminLoading />}>
            <AdminLayout />
          </Suspense>
        }
      >
        {/* Dashboard is the index page */}
        <Route index element={<Suspense fallback={<AdminLoading />}><AdminDashboardView /></Suspense>} />

        {/* Destination management */}
        <Route path="destinations" element={<Suspense fallback={<AdminLoading />}><DestinationManagementView /></Suspense>} />

        {/* Shift tasks management */}
        <Route path="shift-tasks" element={<Suspense fallback={<AdminLoading />}><ShiftTasksView /></Suspense>} />

        {/* Partner Group 6 day splitting */}
        <Route path="partner-split" element={<Suspense fallback={<AdminLoading />}><PartnerSplitView /></Suspense>} />
      </Route>

      {/* Portal routes */}
      <Route
        path="/portal"
        element={
          <Suspense fallback={<OpsLoading />}>
            <PortalShell />
          </Suspense>
        }
      >
        <Route index element={<Suspense fallback={<OpsLoading />}><TodayView /></Suspense>} />
        <Route path="roster" element={<Suspense fallback={<OpsLoading />}><RosterView /></Suspense>} />
        <Route path="pipeline" element={<Suspense fallback={<OpsLoading />}><PipelineView /></Suspense>} />
      </Route>

      {/* Catch-all redirect to tracker */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
