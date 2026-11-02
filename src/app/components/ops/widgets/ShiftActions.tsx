import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { useOpsStore } from '@/services/opsState';
import { SHIFT_TYPE_NAMES, TIME_SLOT_NAMES, type ShiftAssignment, type TimeSlot } from '@/types/ops';

interface ShiftActionsProps {
  shift: ShiftAssignment;
  onClose?: () => void;
}

/**
 * Shift action panel - allows volunteers to offer swaps, claim shifts, etc.
 */
export const ShiftActions: React.FC<ShiftActionsProps> = ({ shift, onClose }) => {
  const {
    currentVolunteer,
    volunteers,
    toggleShiftConfirmation,
    updateShiftAssignment,
    requestShiftSwap,
  } = useOpsStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'confirm' | 'swap' | 'transfer' | null>(null);
  const [selectedVolunteer, setSelectedVolunteer] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isMyShift = currentVolunteer?.id === shift.volunteer_id;
  const timeSlot = shift.time_slot as TimeSlot;

  const handleConfirmToggle = async () => {
    setIsSubmitting(true);
    try {
      await toggleShiftConfirmation(shift.id);
      setMessage({ type: 'success', text: shift.is_confirmed ? 'Shift unconfirmed' : 'Shift confirmed!' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to update shift' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransfer = async (volunteerIdOverride?: string) => {
    const targetVolunteerId = volunteerIdOverride || selectedVolunteer;
    if (!targetVolunteerId) {
      setMessage({ type: 'error', text: 'Please select a volunteer' });
      return;
    }

    setIsSubmitting(true);
    try {
      await updateShiftAssignment(shift.id, { volunteer_id: targetVolunteerId });
      setMessage({ type: 'success', text: 'Shift transferred successfully!' });
      setTimeout(() => onClose?.(), 1500);
    } catch {
      setMessage({ type: 'error', text: 'Failed to transfer shift' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestSwap = async () => {
    if (!selectedVolunteer) {
      setMessage({ type: 'error', text: 'Please select a volunteer' });
      return;
    }

    setIsSubmitting(true);
    try {
      await requestShiftSwap(shift.id, selectedVolunteer);
      setMessage({ type: 'success', text: 'Swap request sent!' });
      setTimeout(() => onClose?.(), 1500);
    } catch {
      setMessage({ type: 'error', text: 'Failed to request swap' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const otherVolunteers = volunteers.filter(v => v.id !== shift.volunteer_id);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 text-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">
              {SHIFT_TYPE_NAMES[shift.shift_type || ''] || shift.shift_type}
            </h3>
            <p className="text-sm text-slate-300">{TIME_SLOT_NAMES[timeSlot]}</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-300 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Current assignment */}
      <div className="p-4 border-b border-slate-100">
        <p className="text-sm text-slate-500 mb-1">Currently assigned to:</p>
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold">
            {shift.volunteer?.display_name?.charAt(0) || '?'}
          </span>
          <span className="font-medium text-slate-900">
            {shift.volunteer?.display_name || 'Unassigned'}
            {isMyShift && <span className="text-emerald-600 text-sm ml-1">(you)</span>}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 space-y-3">
        {/* Confirm/Unconfirm (only for own shifts) */}
        {isMyShift && (
          <button
            onClick={handleConfirmToggle}
            disabled={isSubmitting}
            className={cn(
              'w-full py-2 px-4 rounded-lg font-medium transition-colors',
              shift.is_confirmed
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-emerald-600 text-white hover:bg-emerald-700',
              isSubmitting && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isSubmitting ? '...' : shift.is_confirmed ? 'Unconfirm Shift' : 'Confirm Shift'}
          </button>
        )}

        {/* Transfer shift (only for own shifts) */}
        {isMyShift && (
          <div className="space-y-2">
            <button
              onClick={() => setSelectedAction(selectedAction === 'transfer' ? null : 'transfer')}
              className="w-full py-2 px-4 rounded-lg font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
            >
              {selectedAction === 'transfer' ? 'Cancel' : 'Transfer to Someone Else'}
            </button>

            {selectedAction === 'transfer' && (
              <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                <p className="text-sm text-slate-600">Select who should take this shift:</p>
                <select
                  value={selectedVolunteer}
                  onChange={e => setSelectedVolunteer(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="">Choose a volunteer...</option>
                  {otherVolunteers.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.display_name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleTransfer()}
                  disabled={isSubmitting || !selectedVolunteer}
                  className="w-full py-2 px-4 rounded-lg font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Transferring...' : 'Confirm Transfer'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Request swap (only for own shifts) */}
        {isMyShift && (
          <div className="space-y-2">
            <button
              onClick={() => setSelectedAction(selectedAction === 'swap' ? null : 'swap')}
              className="w-full py-2 px-4 rounded-lg font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
            >
              {selectedAction === 'swap' ? 'Cancel' : 'Request Swap'}
            </button>

            {selectedAction === 'swap' && (
              <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                <p className="text-sm text-slate-600">Request to swap with another volunteer:</p>
                <select
                  value={selectedVolunteer}
                  onChange={e => setSelectedVolunteer(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="">Choose a volunteer...</option>
                  {otherVolunteers.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.display_name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleRequestSwap}
                  disabled={isSubmitting || !selectedVolunteer}
                  className="w-full py-2 px-4 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Sending...' : 'Send Swap Request'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Claim shift (for other people's shifts) */}
        {!isMyShift && currentVolunteer && (
          <button
            onClick={() => handleTransfer(currentVolunteer.id)}
            disabled={isSubmitting}
            className="w-full py-2 px-4 rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Claiming...' : 'Claim This Shift'}
          </button>
        )}
      </div>

      {/* Message */}
      {message && (
        <div
          className={cn(
            'px-4 py-3 text-sm',
            message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          )}
        >
          {message.text}
        </div>
      )}
    </div>
  );
};

export default ShiftActions;
