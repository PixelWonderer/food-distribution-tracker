import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useOpsStore } from '@/services/opsState';
import {
  formatWeekDate,
  TIME_SLOT_NAMES,
  type ShiftAssignment,
} from '@/types/ops';
import { ShiftCard } from '../widgets/ShiftCard';
import { ShiftActions } from '../widgets/ShiftActions';

/**
 * Personalized volunteer view showing their shifts and relevant info
 */
const VolunteerView: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const {
    volunteers,
    shiftAssignments,
    selectedWeek,
    currentVolunteer,
    setCurrentVolunteer,
    fetchShifts,
  } = useOpsStore();

  const [selectedShift, setSelectedShift] = useState<ShiftAssignment | null>(null);

  // Find the volunteer by slug
  const volunteer = useMemo(() => {
    return volunteers.find(v => v.slug === slug);
  }, [volunteers, slug]);

  // Get this volunteer's shifts
  const myShifts = useMemo(() => {
    if (!volunteer) return [];
    return shiftAssignments
      .filter(s => s.volunteer_id === volunteer.id)
      .sort((a, b) => {
        // Sort by time slot order
        const slots = Object.keys(TIME_SLOT_NAMES);
        return slots.indexOf(a.time_slot || '') - slots.indexOf(b.time_slot || '');
      });
  }, [volunteer, shiftAssignments]);

  // Fetch shifts when component mounts
  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  // Set as current volunteer if viewing own page
  const handleSetAsMe = () => {
    if (volunteer) {
      setCurrentVolunteer(volunteer.slug);
    }
  };

  if (!volunteer) {
    return (
      <div className="text-center py-12">
        <span className="text-4xl mb-4 block">👤</span>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Volunteer not found</h3>
        <p className="text-slate-500 mb-4">
          The volunteer "{slug}" doesn't exist in the system.
        </p>
        <Link to="/ops/overview" className="text-emerald-600 hover:text-emerald-700">
          ← View all volunteers
        </Link>
      </div>
    );
  }

  const isMe = currentVolunteer?.slug === volunteer.slug;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-2xl font-bold text-emerald-700">
            {volunteer.display_name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{volunteer.display_name}</h1>
              {isMe && (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">
                  You
                </span>
              )}
            </div>
            <p className="text-slate-500 mt-1">
              Schedule for week of {formatWeekDate(selectedWeek)}
            </p>
          </div>
        </div>

        {!isMe && (
          <button
            onClick={handleSetAsMe}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
          >
            This is me
          </button>
        )}
      </div>

      {/* Shifts this week */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="font-semibold text-slate-900">My Shifts This Week</h2>
        </div>

        {myShifts.length === 0 ? (
          <div className="p-8 text-center">
            <span className="text-4xl mb-4 block">📅</span>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No shifts scheduled</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              No shifts have been assigned for this week yet. Check back later or contact the
              coordinator.
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {myShifts.map(shift => (
              <button
                key={shift.id}
                onClick={() => setSelectedShift(shift)}
                className="w-full text-left"
              >
                <ShiftCard
                  shift={shift}
                  showVolunteer={false}
                  compact={true}
                />
              </button>
            ))}
            <p className="text-xs text-slate-400 text-center pt-2">
              Click on a shift to manage it
            </p>
          </div>
        )}
      </div>

      {/* Quick links to relevant guides */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Helpful Resources</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/ops/guide?category=procedures"
            className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all"
          >
            <span className="text-xl">📋</span>
            <div>
              <p className="font-medium text-slate-700">Procedures</p>
              <p className="text-sm text-slate-500">How-to guides for common tasks</p>
            </div>
          </Link>
          <Link
            to="/ops/guide?category=routes"
            className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all"
          >
            <span className="text-xl">🚛</span>
            <div>
              <p className="font-medium text-slate-700">Routes</p>
              <p className="text-sm text-slate-500">Pickup and delivery routes</p>
            </div>
          </Link>
          <Link
            to="/ops/guide?category=locations"
            className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all"
          >
            <span className="text-xl">📍</span>
            <div>
              <p className="font-medium text-slate-700">Locations</p>
              <p className="text-sm text-slate-500">Addresses and venue info</p>
            </div>
          </Link>
          <Link
            to="/ops/guide?category=contacts"
            className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all"
          >
            <span className="text-xl">👥</span>
            <div>
              <p className="font-medium text-slate-700">Contacts</p>
              <p className="text-sm text-slate-500">People and organizations</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Shift action modal */}
      {selectedShift && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setSelectedShift(null)}
        >
          <div
            className="max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            <ShiftActions shift={selectedShift} onClose={() => setSelectedShift(null)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default VolunteerView;
