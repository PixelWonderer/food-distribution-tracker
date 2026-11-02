import React, { useEffect, useState } from 'react';
import { useOpsStore } from '@/services/opsState';
import {
  formatWeekDate,
  getMonday,
  SHIFT_TYPE_NAMES,
  TIME_SLOT_NAMES,
  type ShiftAssignment,
  type ShiftChangeLogEntry,
  type ShiftType,
  type TimeSlot,
} from '@/types/ops';
import { cn } from '@/lib/utils';
import { CoverageExport } from '../widgets/CoverageExport';
import { HandoffEditor } from '../widgets/HandoffEditor';
import { HandoffChain } from '../widgets/HandoffChain';
import { ShiftDetailsEditor } from '../widgets/ShiftDetailsEditor';
import { CoverageScenarioManager } from '../widgets/CoverageScenarioManager';

/**
 * Schedule management view - for coordinators to create/edit shift assignments
 */
const ScheduleView: React.FC = () => {
  const {
    volunteers,
    shiftAssignments,
    shiftChangeLog,
    selectedWeek,
    setSelectedWeek,
    fetchShifts,
    fetchShiftChangeLog,
    createShiftAssignment,
    deleteShiftAssignment,
    copyShiftsFromWeek,
    getShiftsForWeek,
    isLoading,
  } = useOpsStore();

  const [isAddingShift, setIsAddingShift] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftAssignment | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Copy from last week state
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [lastWeekShifts, setLastWeekShifts] = useState<ShiftAssignment[]>([]);
  const [isCopying, setIsCopying] = useState(false);

  // Change log modal state
  const [showChangeLog, setShowChangeLog] = useState(false);

  // Export modal state
  const [showExport, setShowExport] = useState(false);

  // Handoff modal state
  const [showHandoff, setShowHandoff] = useState(false);

  // Shift details editor state
  const [showShiftDetails, setShowShiftDetails] = useState(false);
  const [editingShiftType, setEditingShiftType] = useState<ShiftType | null>(null);

  // Coverage scenario manager state
  const [showCoverageScenarios, setShowCoverageScenarios] = useState(false);

  // Form state for new/edit shift
  const [formData, setFormData] = useState({
    volunteer_id: '',
    shift_type: '' as ShiftType | '',
    time_slot: '' as TimeSlot | '',
    notes: '',
    is_confirmed: false,
  });

  // Fetch shifts when component mounts or week changes
  useEffect(() => {
    fetchShifts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek]);

  // Available shift types and time slots
  const shiftTypes: ShiftType[] = [
    'produce_market',
    'truck_loading',
    'grocery_distribution',
    'saturday_distribution',
    'saturday_evening_run',
    'sunday_distribution',
  ];

  const timeSlots: TimeSlot[] = [
    'thursday_evening',
    'friday_am',
    'friday_noon',
    'friday_pm',
    'saturday_am',
    'saturday_noon',
    'saturday_pm',
    'saturday_evening',
    'sunday_afternoon',
  ];

  // Week navigation
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
    setSelectedWeek(getMonday(new Date()).toISOString().split('T')[0]);
  };

  // Open add shift form
  const handleAddShift = () => {
    setFormData({
      volunteer_id: '',
      shift_type: '',
      time_slot: '',
      notes: '',
      is_confirmed: false,
    });
    setEditingShift(null);
    setIsAddingShift(true);
    setMessage(null);
  };

  // Open edit shift form
  const handleEditShift = (shift: ShiftAssignment) => {
    setFormData({
      volunteer_id: shift.volunteer_id,
      shift_type: shift.shift_type as ShiftType,
      time_slot: (shift.time_slot || '') as TimeSlot | '',
      notes: shift.notes || '',
      is_confirmed: shift.is_confirmed,
    });
    setEditingShift(shift);
    setIsAddingShift(true);
    setMessage(null);
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.volunteer_id || !formData.shift_type || !formData.time_slot) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    try {
      if (editingShift) {
        // Update existing shift
        await useOpsStore.getState().updateShiftAssignment(editingShift.id, {
          volunteer_id: formData.volunteer_id,
          shift_type: formData.shift_type as ShiftType,
          time_slot: formData.time_slot as TimeSlot,
          notes: formData.notes || undefined,
          is_confirmed: formData.is_confirmed,
        });
        setMessage({ type: 'success', text: 'Shift updated successfully!' });
      } else {
        // Create new shift
        await createShiftAssignment({
          volunteer_id: formData.volunteer_id,
          week_date: selectedWeek,
          shift_type: formData.shift_type as ShiftType,
          time_slot: formData.time_slot as TimeSlot,
          notes: formData.notes || undefined,
          is_confirmed: formData.is_confirmed,
        });
        setMessage({ type: 'success', text: 'Shift created successfully!' });
      }

      setIsAddingShift(false);
      setEditingShift(null);
    } catch {
      setMessage({ type: 'error', text: 'Failed to save shift' });
    }
  };

  // Delete shift
  const handleDeleteShift = async (shiftId: string) => {
    if (!confirm('Are you sure you want to delete this shift?')) return;

    try {
      await deleteShiftAssignment(shiftId);
      setMessage({ type: 'success', text: 'Shift deleted successfully!' });
      setIsAddingShift(false);
      setEditingShift(null);
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete shift' });
    }
  };

  // Get last week's date
  const getLastWeekDate = () => {
    const current = new Date(selectedWeek);
    current.setDate(current.getDate() - 7);
    return getMonday(current).toISOString().split('T')[0];
  };

  // Open copy modal and fetch last week's shifts
  const handleOpenCopyModal = async () => {
    const lastWeek = getLastWeekDate();
    setIsCopying(true);
    try {
      const shifts = await getShiftsForWeek(lastWeek);
      setLastWeekShifts(shifts);
      setShowCopyModal(true);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load last week\'s schedule' });
    } finally {
      setIsCopying(false);
    }
  };

  // Execute copy
  const handleCopyFromLastWeek = async (clearExisting: boolean) => {
    setIsCopying(true);
    try {
      const lastWeek = getLastWeekDate();
      const result = await copyShiftsFromWeek(lastWeek, selectedWeek, clearExisting);
      setShowCopyModal(false);
      if (result.copied > 0) {
        setMessage({ type: 'success', text: `Copied ${result.copied} shifts from last week` });
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to copy shifts' });
    } finally {
      setIsCopying(false);
    }
  };

  // Group shifts by time slot
  const shiftsByTimeSlot = timeSlots.reduce(
    (acc, slot) => {
      acc[slot] = shiftAssignments.filter(s => s.time_slot === slot);
      return acc;
    },
    {} as Record<TimeSlot, ShiftAssignment[]>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manage Schedule</h1>
          <p className="text-slate-500 mt-1">Create and edit shift assignments</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowHandoff(true)}
            className="px-4 py-2 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors font-medium"
          >
            🔑 Handoffs
          </button>
          <button
            onClick={() => setShowExport(true)}
            className="px-4 py-2 border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors font-medium"
          >
            📤 Export
          </button>
          <button
            onClick={() => setShowShiftDetails(true)}
            className="px-4 py-2 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors font-medium"
          >
            ⚙️ Shift Details
          </button>
          <button
            onClick={() => setShowCoverageScenarios(true)}
            className="px-4 py-2 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 transition-colors font-medium"
          >
            ⚠️ Coverage
          </button>
          <button
            onClick={() => {
              fetchShiftChangeLog(selectedWeek);
              setShowChangeLog(true);
            }}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
          >
            View Changes
          </button>
          <button
            onClick={handleOpenCopyModal}
            disabled={isCopying}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium disabled:opacity-50"
          >
            {isCopying ? 'Loading...' : 'Copy from Last Week'}
          </button>
          <button
            onClick={handleAddShift}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
          >
            + Add Shift
          </button>
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-4">
        <button
          onClick={handlePrevWeek}
          className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          ← Previous
        </button>

        <div className="text-center">
          <p className="text-lg font-semibold text-slate-900">
            Week of {formatWeekDate(selectedWeek)}
          </p>
          <button
            onClick={handleThisWeek}
            className="text-sm text-emerald-600 hover:text-emerald-700"
          >
            Go to current week
          </button>
        </div>

        <button
          onClick={handleNextWeek}
          className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          Next →
        </button>
      </div>

      {/* Message */}
      {message && (
        <div
          className={cn(
            'px-4 py-3 rounded-lg text-sm',
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          )}
        >
          {message.text}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading schedule...</p>
        </div>
      )}

      {/* Shift list by time slot */}
      {!isLoading && (
        <div className="space-y-4">
          {timeSlots.map(slot => {
            const shifts = shiftsByTimeSlot[slot];
            if (shifts.length === 0) return null;

            return (
              <div
                key={slot}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden"
              >
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-900">{TIME_SLOT_NAMES[slot]}</h3>
                </div>

                <div className="divide-y divide-slate-100">
                  {shifts.map(shift => (
                    <div
                      key={shift.id}
                      className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
                            shift.is_confirmed
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          )}
                        >
                          {shift.volunteer?.display_name?.charAt(0) || '?'}
                        </span>
                        <div>
                          <p className="font-medium text-slate-900">
                            {shift.volunteer?.display_name || 'Unknown'}
                            {shift.is_confirmed && (
                              <span className="ml-2 text-xs text-emerald-600">Confirmed</span>
                            )}
                          </p>
                          <p className="text-sm text-slate-500">
                            {SHIFT_TYPE_NAMES[shift.shift_type] || shift.shift_type}
                            {shift.notes && ` • ${shift.notes}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditShift(shift)}
                          className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteShift(shift.id)}
                          className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {shiftAssignments.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <span className="text-4xl mb-4 block">📅</span>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No shifts scheduled</h3>
              <p className="text-slate-500 max-w-md mx-auto mb-4">
                No shifts have been created for this week yet.
              </p>
              <button
                onClick={handleAddShift}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
              >
                Create First Shift
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Shift Modal */}
      {isAddingShift && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setIsAddingShift(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingShift ? 'Edit Shift' : 'Add New Shift'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Volunteer selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Volunteer *
                </label>
                <select
                  value={formData.volunteer_id}
                  onChange={e => setFormData({ ...formData, volunteer_id: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                  required
                >
                  <option value="">Select volunteer...</option>
                  {volunteers.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.display_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Shift type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Shift Type *
                </label>
                <select
                  value={formData.shift_type}
                  onChange={e => setFormData({ ...formData, shift_type: e.target.value as ShiftType })}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                  required
                >
                  <option value="">Select shift type...</option>
                  {shiftTypes.map(type => (
                    <option key={type} value={type}>
                      {SHIFT_TYPE_NAMES[type]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Time slot */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Time Slot *
                </label>
                <select
                  value={formData.time_slot}
                  onChange={e => setFormData({ ...formData, time_slot: e.target.value as TimeSlot })}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                  required
                >
                  <option value="">Select time slot...</option>
                  {timeSlots.map(slot => (
                    <option key={slot} value={slot}>
                      {TIME_SLOT_NAMES[slot]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional notes..."
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>

              {/* Confirmed toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_confirmed"
                  checked={formData.is_confirmed}
                  onChange={e => setFormData({ ...formData, is_confirmed: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <label htmlFor="is_confirmed" className="text-sm text-slate-700">
                  Mark as confirmed
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddingShift(false)}
                  className="flex-1 px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                >
                  {editingShift ? 'Save Changes' : 'Create Shift'}
                </button>
              </div>

              {/* Delete button for editing */}
              {editingShift && (
                <button
                  type="button"
                  onClick={() => handleDeleteShift(editingShift.id)}
                  className="w-full px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Delete This Shift
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Copy from Last Week Modal */}
      {showCopyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowCopyModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">
                Copy from Last Week
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Week of {formatWeekDate(getLastWeekDate())}
              </p>
            </div>

            <div className="p-6">
              {lastWeekShifts.length === 0 ? (
                <div className="text-center py-6">
                  <span className="text-3xl mb-3 block">📭</span>
                  <p className="text-slate-600">No shifts found last week</p>
                  <p className="text-sm text-slate-500 mt-1">
                    There are no shifts to copy from last week.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <p className="text-sm text-slate-600 mb-3">
                      Found <strong>{lastWeekShifts.length} shifts</strong> from last week:
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-100 rounded-lg p-3 bg-slate-50">
                      {lastWeekShifts.map(shift => (
                        <div key={shift.id} className="flex items-center gap-2 text-sm">
                          <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium">
                            {shift.volunteer?.display_name?.charAt(0) || '?'}
                          </span>
                          <span className="text-slate-900">{shift.volunteer?.display_name || 'Unknown'}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500">{TIME_SLOT_NAMES[shift.time_slot!]}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {shiftAssignments.length > 0 && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">
                        <strong>Note:</strong> This week already has {shiftAssignments.length} shift(s).
                        Choose how to handle them:
                      </p>
                    </div>
                  )}
                </>
              )}

              <div className="flex flex-col gap-2 pt-4">
                {lastWeekShifts.length > 0 && (
                  <>
                    {shiftAssignments.length > 0 ? (
                      <>
                        <button
                          onClick={() => handleCopyFromLastWeek(false)}
                          disabled={isCopying}
                          className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50"
                        >
                          {isCopying ? 'Copying...' : 'Add to Existing'}
                        </button>
                        <button
                          onClick={() => handleCopyFromLastWeek(true)}
                          disabled={isCopying}
                          className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium disabled:opacity-50"
                        >
                          {isCopying ? 'Copying...' : 'Replace All'}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleCopyFromLastWeek(false)}
                        disabled={isCopying}
                        className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50"
                      >
                        {isCopying ? 'Copying...' : `Copy ${lastWeekShifts.length} Shifts`}
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={() => setShowCopyModal(false)}
                  className="w-full px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Log Modal */}
      {showChangeLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowChangeLog(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <h2 className="text-lg font-semibold text-slate-900">Change Log</h2>
              <p className="text-sm text-slate-500 mt-1">
                Week of {formatWeekDate(selectedWeek)}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {shiftChangeLog.length === 0 ? (
                <div className="text-center py-8">
                  <span className="text-3xl mb-3 block">📝</span>
                  <p className="text-slate-600">No changes recorded yet</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Changes to shifts will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {shiftChangeLog.map(entry => (
                    <ChangeLogEntry key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
              <button
                onClick={() => setShowChangeLog(false)}
                className="w-full px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowExport(false)}
        >
          <div onClick={e => e.stopPropagation()}>
            <CoverageExport onClose={() => setShowExport(false)} />
          </div>
        </div>
      )}

      {/* Handoff Modal */}
      {showHandoff && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 overflow-y-auto"
          onClick={() => setShowHandoff(false)}
        >
          <div
            className="my-8 space-y-4 max-w-lg w-full"
            onClick={e => e.stopPropagation()}
          >
            {/* Handoff Editor */}
            <HandoffEditor
              weekDate={selectedWeek}
              onClose={() => setShowHandoff(false)}
            />

            {/* Existing Handoff Chain */}
            <div className="bg-white rounded-2xl shadow-xl p-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <span>🔗</span>
                Current Handoffs
              </h3>
              <HandoffChain weekDate={selectedWeek} />
            </div>
          </div>
        </div>
      )}

      {/* Shift Details Modal */}
      {showShiftDetails && !editingShiftType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowShiftDetails(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-purple-600 text-white">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <span>⚙️</span>
                  Shift Details
                </h2>
                <button
                  onClick={() => setShowShiftDetails(false)}
                  className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-purple-100 text-sm mt-1">
                Edit timelines, checklists, and content for each shift type
              </p>
            </div>

            <div className="p-4 space-y-2 overflow-y-auto max-h-[60vh]">
              {shiftTypes.map(type => (
                <button
                  key={type}
                  onClick={() => setEditingShiftType(type)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-purple-300 hover:bg-purple-50 transition-colors text-left"
                >
                  <span className="text-xl">📋</span>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{SHIFT_TYPE_NAMES[type]}</p>
                    <p className="text-xs text-slate-500">Click to edit details</p>
                  </div>
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Shift Details Editor */}
      {editingShiftType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => {
            setEditingShiftType(null);
            setShowShiftDetails(false);
          }}
        >
          <div onClick={e => e.stopPropagation()}>
            <ShiftDetailsEditor
              shiftType={editingShiftType}
              onClose={() => {
                setEditingShiftType(null);
                setShowShiftDetails(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Coverage Scenario Manager Modal */}
      {showCoverageScenarios && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowCoverageScenarios(false)}
        >
          <div onClick={e => e.stopPropagation()}>
            <CoverageScenarioManager onClose={() => setShowCoverageScenarios(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

// Change log entry component
const ChangeLogEntry: React.FC<{ entry: ShiftChangeLogEntry }> = ({ entry }) => {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created': return '➕';
      case 'deleted': return '🗑️';
      case 'confirmed': return '✅';
      case 'unconfirmed': return '⏸️';
      case 'transferred': return '🔄';
      case 'copied': return '📋';
      default: return '📝';
    }
  };

  const getActionText = (entry: ShiftChangeLogEntry) => {
    switch (entry.action) {
      case 'created':
        return `${entry.new_volunteer_name || 'Someone'} was assigned to ${SHIFT_TYPE_NAMES[entry.shift_type || ''] || entry.shift_type}`;
      case 'deleted':
        return `${entry.previous_volunteer_name || 'Someone'}'s ${SHIFT_TYPE_NAMES[entry.shift_type || ''] || entry.shift_type} shift was removed`;
      case 'confirmed':
        return `${entry.new_volunteer_name || 'Someone'} confirmed their ${TIME_SLOT_NAMES[entry.time_slot as TimeSlot] || entry.time_slot} shift`;
      case 'unconfirmed':
        return `${entry.new_volunteer_name || 'Someone'}'s ${TIME_SLOT_NAMES[entry.time_slot as TimeSlot] || entry.time_slot} shift was unconfirmed`;
      case 'transferred':
        return `Shift transferred from ${entry.previous_volunteer_name || 'someone'} to ${entry.new_volunteer_name || 'someone'}`;
      case 'copied':
        return entry.notes || 'Shifts copied from another week';
      default:
        return 'Schedule was updated';
    }
  };

  return (
    <div className="flex gap-3 p-3 bg-slate-50 rounded-lg">
      <span className="text-lg">{getActionIcon(entry.action)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-900">{getActionText(entry)}</p>
        <p className="text-xs text-slate-500 mt-1">
          {formatTime(entry.created_at)}
          {entry.changed_by_name && (
            <span className="ml-2">by {entry.changed_by_name}</span>
          )}
        </p>
      </div>
    </div>
  );
};

export default ScheduleView;
