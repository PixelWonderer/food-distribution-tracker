import React, { useState } from 'react';
import { useOpsStore } from '@/services/opsState';
import {
  type HandoffItemType,
  type HandoffStatus,
  type TimeSlot,
  type ShiftType,
  TIME_SLOT_NAMES,
  SHIFT_TYPE_NAMES,
  HANDOFF_TYPE_INFO,
  HANDOFF_STATUS_INFO,
} from '@/types/ops';
import { cn } from '@/lib/utils';

interface HandoffEditorProps {
  weekDate: string;
  onClose: () => void;
  editingHandoffId?: string;
}

/**
 * Component for creating and editing handoffs (key transfers, equipment, etc.)
 */
export const HandoffEditor: React.FC<HandoffEditorProps> = ({
  weekDate,
  onClose,
  editingHandoffId,
}) => {
  const {
    volunteers,
    handoffs,
    createHandoff,
    updateHandoffStatus,
    deleteHandoff,
  } = useOpsStore();

  // Get existing handoff if editing
  const existingHandoff = editingHandoffId
    ? handoffs.find(h => h.id === editingHandoffId)
    : null;

  // Form state
  const [itemType, setItemType] = useState<HandoffItemType>(
    existingHandoff?.item_type || 'truck_key'
  );
  const [itemName, setItemName] = useState(
    existingHandoff?.item_name || ''
  );
  const [fromVolunteerId, setFromVolunteerId] = useState(
    existingHandoff?.from_volunteer_id || ''
  );
  const [toVolunteerId, setToVolunteerId] = useState(
    existingHandoff?.to_volunteer_id || ''
  );
  const [fromShiftType, setFromShiftType] = useState<ShiftType | ''>(
    existingHandoff?.from_shift_type || ''
  );
  const [toShiftType, setToShiftType] = useState<ShiftType | ''>(
    existingHandoff?.to_shift_type || ''
  );
  const [handoffTime, setHandoffTime] = useState<TimeSlot | ''>(
    existingHandoff?.handoff_time || ''
  );
  const [notes, setNotes] = useState(existingHandoff?.notes || '');
  const [status, setStatus] = useState<HandoffStatus>(
    existingHandoff?.status || 'pending'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Item type options
  const itemTypes: { value: HandoffItemType; label: string; icon: string }[] = [
    { value: 'truck_key', label: 'Truck Key', icon: '🔑' },
    { value: 'door_code', label: 'Door Code', icon: '🚪' },
    { value: 'warehouse_key', label: 'Warehouse Key', icon: '🏭' },
    { value: 'equipment', label: 'Equipment', icon: '📦' },
    { value: 'other', label: 'Other', icon: '📋' },
  ];

  // Time slot options
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

  // Shift type options
  const shiftTypes: ShiftType[] = [
    'produce_market',
    'truck_loading',
    'grocery_distribution',
    'saturday_distribution',
    'saturday_evening_run',
    'sunday_distribution',
  ];

  // Auto-fill item name based on type
  const handleItemTypeChange = (type: HandoffItemType) => {
    setItemType(type);
    if (!itemName || itemName === HANDOFF_TYPE_INFO[itemType]?.name) {
      const info = HANDOFF_TYPE_INFO[type];
      if (info) {
        setItemName(info.name);
      }
    }
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!itemName.trim()) {
      setError('Item name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingHandoffId) {
        // Update existing handoff (just status and notes for now)
        await updateHandoffStatus(editingHandoffId, status, notes);
      } else {
        // Create new handoff
        await createHandoff({
          week_date: weekDate,
          item_type: itemType,
          item_name: itemName.trim(),
          from_volunteer_id: fromVolunteerId || undefined,
          to_volunteer_id: toVolunteerId || undefined,
          from_shift_type: fromShiftType || undefined,
          to_shift_type: toShiftType || undefined,
          handoff_time: handoffTime || undefined,
          status,
          notes: notes.trim() || undefined,
        });
      }
      onClose();
    } catch (err) {
      console.error('Failed to save handoff:', err);
      setError('Failed to save handoff. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!editingHandoffId) return;
    if (!confirm('Are you sure you want to delete this handoff?')) return;

    setIsSubmitting(true);
    try {
      await deleteHandoff(editingHandoffId);
      onClose();
    } catch (err) {
      console.error('Failed to delete handoff:', err);
      setError('Failed to delete handoff.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-lg w-full">
      {/* Header */}
      <div className="px-6 py-4 bg-amber-500 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔑</span>
            <h2 className="text-lg font-bold">
              {editingHandoffId ? 'Edit Handoff' : 'New Handoff'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Item Type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Item Type *
          </label>
          <div className="flex flex-wrap gap-2">
            {itemTypes.map(type => (
              <button
                key={type.value}
                type="button"
                onClick={() => handleItemTypeChange(type.value)}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  itemType === type.value
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                <span className="mr-1">{type.icon}</span>
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Item Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Item Name *
          </label>
          <input
            type="text"
            value={itemName}
            onChange={e => setItemName(e.target.value)}
            placeholder="e.g., Truck Key, Warehouse Code"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>

        {/* From/To Volunteers */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              From (Volunteer)
            </label>
            <select
              value={fromVolunteerId}
              onChange={e => setFromVolunteerId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Select...</option>
              {volunteers.map(v => (
                <option key={v.id} value={v.id}>
                  {v.display_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              To (Volunteer)
            </label>
            <select
              value={toVolunteerId}
              onChange={e => setToVolunteerId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Select...</option>
              {volunteers.map(v => (
                <option key={v.id} value={v.id}>
                  {v.display_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* From/To Shifts */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              From (Shift)
            </label>
            <select
              value={fromShiftType}
              onChange={e => setFromShiftType(e.target.value as ShiftType | '')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Select...</option>
              {shiftTypes.map(type => (
                <option key={type} value={type}>
                  {SHIFT_TYPE_NAMES[type] || type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              To (Shift)
            </label>
            <select
              value={toShiftType}
              onChange={e => setToShiftType(e.target.value as ShiftType | '')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Select...</option>
              {shiftTypes.map(type => (
                <option key={type} value={type}>
                  {SHIFT_TYPE_NAMES[type] || type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Handoff Time */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Handoff Time
          </label>
          <select
            value={handoffTime}
            onChange={e => setHandoffTime(e.target.value as TimeSlot | '')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">Select time slot...</option>
            {timeSlots.map(slot => (
              <option key={slot} value={slot}>
                {TIME_SLOT_NAMES[slot]}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Status
          </label>
          <div className="flex gap-2">
            {(['pending', 'confirmed', 'completed'] as HandoffStatus[]).map(s => {
              const info = HANDOFF_STATUS_INFO[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    status === s
                      ? s === 'completed'
                        ? 'bg-green-500 text-white'
                        : s === 'confirmed'
                        ? 'bg-blue-500 text-white'
                        : 'bg-amber-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  {info.icon} {info.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g., Leave key in truck cab, near cup holders, covered"
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          {editingHandoffId ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            >
              Delete
            </button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                'px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors',
                isSubmitting
                  ? 'bg-amber-400 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-600'
              )}
            >
              {isSubmitting ? 'Saving...' : editingHandoffId ? 'Update' : 'Create Handoff'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default HandoffEditor;
