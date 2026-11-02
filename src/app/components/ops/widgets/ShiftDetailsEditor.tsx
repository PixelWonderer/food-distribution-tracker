import React, { useState } from 'react';
import { useOpsStore } from '@/services/opsState';
import {
  type ShiftType,
  type ShiftDetails,
  type TimelineItem,
  type ChecklistItem,
  SHIFT_TYPE_NAMES,
} from '@/types/ops';
import { cn } from '@/lib/utils';

interface ShiftDetailsEditorProps {
  shiftType: ShiftType;
  onClose: () => void;
}

/**
 * Editor for shift details - allows coordinators to edit rich content
 * including timeline, checklist, location, and markdown content.
 */
export const ShiftDetailsEditor: React.FC<ShiftDetailsEditorProps> = ({
  shiftType,
  onClose,
}) => {
  const { shiftDetails, updateShiftDetails } = useOpsStore();

  // Find existing details for this shift type
  const existingDetails = shiftDetails.find(sd => sd.shift_type === shiftType);

  // Form state
  const [displayName, setDisplayName] = useState(
    existingDetails?.display_name || SHIFT_TYPE_NAMES[shiftType] || ''
  );
  const [description, setDescription] = useState(existingDetails?.description || '');
  const [content, setContent] = useState(existingDetails?.content || '');
  const [location, setLocation] = useState(existingDetails?.location || '');
  const [locationUrl, setLocationUrl] = useState(existingDetails?.location_url || '');
  const [icon, setIcon] = useState(existingDetails?.icon || '📋');
  const [color, setColor] = useState(existingDetails?.color || 'slate');
  const [timeline, setTimeline] = useState<TimelineItem[]>(
    existingDetails?.timeline || []
  );
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    existingDetails?.checklist || []
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'timeline' | 'checklist' | 'content'>('basic');

  // Color options
  const colors = [
    { value: 'slate', label: 'Gray', bg: 'bg-slate-100' },
    { value: 'green', label: 'Green', bg: 'bg-green-100' },
    { value: 'blue', label: 'Blue', bg: 'bg-blue-100' },
    { value: 'amber', label: 'Amber', bg: 'bg-amber-100' },
    { value: 'orange', label: 'Orange', bg: 'bg-orange-100' },
    { value: 'cyan', label: 'Cyan', bg: 'bg-cyan-100' },
  ];

  // Icon options
  const icons = ['📋', '🚚', '📦', '🥬', '🏪', '🌙', '🍲', '🔑', '🏭', '📍'];

  // Timeline management
  const addTimelineItem = () => {
    setTimeline([...timeline, { time: '', task: '' }]);
  };

  const updateTimelineItem = (index: number, field: 'time' | 'task', value: string) => {
    const updated = [...timeline];
    updated[index] = { ...updated[index], [field]: value };
    setTimeline(updated);
  };

  const removeTimelineItem = (index: number) => {
    setTimeline(timeline.filter((_, i) => i !== index));
  };

  const moveTimelineItem = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= timeline.length) return;
    const updated = [...timeline];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setTimeline(updated);
  };

  // Checklist management
  const addChecklistItem = () => {
    setChecklist([...checklist, { item: '', required: false }]);
  };

  const updateChecklistItem = (index: number, field: 'item' | 'required', value: string | boolean) => {
    const updated = [...checklist];
    updated[index] = { ...updated[index], [field]: value };
    setChecklist(updated);
  };

  const removeChecklistItem = (index: number) => {
    setChecklist(checklist.filter((_, i) => i !== index));
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const updates: Partial<ShiftDetails> = {
        display_name: displayName.trim(),
        description: description.trim() || undefined,
        content: content.trim() || undefined,
        location: location.trim() || undefined,
        location_url: locationUrl.trim() || undefined,
        icon: icon || undefined,
        color: color || undefined,
        timeline: timeline.filter(t => t.time || t.task),
        checklist: checklist.filter(c => c.item),
      };

      await updateShiftDetails(shiftType, updates);
      onClose();
    } catch (err) {
      console.error('Failed to save shift details:', err);
      setError('Failed to save shift details. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-2xl w-full max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 bg-emerald-600 text-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{icon}</span>
            <h2 className="text-lg font-bold">Edit {displayName || SHIFT_TYPE_NAMES[shiftType]}</h2>
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

      {/* Tabs */}
      <div className="flex border-b border-slate-200 flex-shrink-0">
        {(['basic', 'timeline', 'checklist', 'content'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === tab
                ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            )}
          >
            {tab === 'basic' && '📝 Basic'}
            {tab === 'timeline' && '⏰ Timeline'}
            {tab === 'checklist' && '✅ Checklist'}
            {tab === 'content' && '📄 Content'}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Basic Tab */}
          {activeTab === 'basic' && (
            <>
              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Display Name *
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="e.g., Produce Market Pickup"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Short Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Brief summary for shift cards"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              {/* Icon & Color */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Icon
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {icons.map(i => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setIcon(i)}
                        className={cn(
                          'w-9 h-9 text-lg rounded-lg transition-all',
                          icon === i
                            ? 'bg-emerald-100 ring-2 ring-emerald-500'
                            : 'bg-slate-100 hover:bg-slate-200'
                        )}
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Color
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {colors.map(c => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setColor(c.value)}
                        className={cn(
                          'w-9 h-9 rounded-lg transition-all',
                          c.bg,
                          color === c.value
                            ? 'ring-2 ring-emerald-500 ring-offset-1'
                            : 'hover:ring-2 hover:ring-slate-300'
                        )}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g., Community Center, Main St"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              {/* Location URL */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Location URL (Google Maps)
                </label>
                <input
                  type="url"
                  value={locationUrl}
                  onChange={e => setLocationUrl(e.target.value)}
                  placeholder="https://maps.google.com/?q=..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </>
          )}

          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <>
              <p className="text-sm text-slate-500 mb-3">
                Add the step-by-step schedule for this shift. These will be shown as a timeline preview on shift cards.
              </p>

              <div className="space-y-2">
                {timeline.map((item, index) => (
                  <div key={index} className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
                    <input
                      type="text"
                      value={item.time}
                      onChange={e => updateTimelineItem(index, 'time', e.target.value)}
                      placeholder="~6:30pm"
                      className="w-24 px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono"
                    />
                    <input
                      type="text"
                      value={item.task}
                      onChange={e => updateTimelineItem(index, 'task', e.target.value)}
                      placeholder="Task description..."
                      className="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveTimelineItem(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveTimelineItem(index, 'down')}
                        disabled={index === timeline.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTimelineItem(index)}
                        className="p-1 text-red-400 hover:text-red-600"
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addTimelineItem}
                className="w-full py-2 border-2 border-dashed border-slate-300 text-slate-500 rounded-lg hover:border-emerald-400 hover:text-emerald-600 transition-colors"
              >
                + Add Timeline Step
              </button>
            </>
          )}

          {/* Checklist Tab */}
          {activeTab === 'checklist' && (
            <>
              <p className="text-sm text-slate-500 mb-3">
                List items volunteers should bring or tasks they should complete for this shift.
              </p>

              <div className="space-y-2">
                {checklist.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                    <input
                      type="text"
                      value={item.item}
                      onChange={e => updateChecklistItem(index, 'item', e.target.value)}
                      placeholder="Item or task..."
                      className="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                    <label className="flex items-center gap-1.5 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={item.required}
                        onChange={e => updateChecklistItem(index, 'required', e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded"
                      />
                      Required
                    </label>
                    <button
                      type="button"
                      onClick={() => removeChecklistItem(index)}
                      className="p-1 text-red-400 hover:text-red-600"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addChecklistItem}
                className="w-full py-2 border-2 border-dashed border-slate-300 text-slate-500 rounded-lg hover:border-emerald-400 hover:text-emerald-600 transition-colors"
              >
                + Add Checklist Item
              </button>
            </>
          )}

          {/* Content Tab */}
          {activeTab === 'content' && (
            <>
              <p className="text-sm text-slate-500 mb-3">
                Add detailed instructions, routes, or other notes in Markdown format.
              </p>

              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="## After Produce Market Route

**Partner Group 8** — Drop cakes, offer picks
**Garden** — Treats/groceries for gardeners
**Co-op C** — Produce boxes (1–2 boxes)

## KEY HANDOFF — IMPORTANT
End of night: Leave truck key hidden in cab..."
                rows={15}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono text-sm"
              />

              <p className="text-xs text-slate-400">
                Supports Markdown: **bold**, *italic*, ## headers, - lists
              </p>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-slate-200 flex gap-2 flex-shrink-0 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !displayName.trim()}
            className={cn(
              'flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors',
              isSubmitting || !displayName.trim()
                ? 'bg-emerald-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700'
            )}
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ShiftDetailsEditor;
