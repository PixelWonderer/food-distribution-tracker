import React from 'react';
import { Link } from 'react-router-dom';
import { useOpsStore } from '@/services/opsState';
import {
  type ShiftType,
  type TimeSlot,
  SHIFT_TYPE_NAMES,
  TIME_SLOT_NAMES,
  HANDOFF_STATUS_INFO,
} from '@/types/ops';
import { cn } from '@/lib/utils';

interface ShiftDetailPanelProps {
  shiftType: ShiftType;
  weekDate: string;
  timeSlot?: TimeSlot;
  onClose: () => void;
}

/**
 * Detailed panel showing full shift information including:
 * - Timeline with step-by-step schedule
 * - Checklist of required items
 * - Location with map link
 * - Key handoffs for this shift
 */
export const ShiftDetailPanel: React.FC<ShiftDetailPanelProps> = ({
  shiftType,
  weekDate,
  timeSlot,
  onClose,
}) => {
  const { shiftDetails, handoffs, getShiftDetailsForType, getHandoffsForShift } = useOpsStore();

  // Get shift details
  const details = getShiftDetailsForType(shiftType) || shiftDetails.find(sd => sd.shift_type === shiftType);

  // Get related handoffs
  const relatedHandoffs = getHandoffsForShift(shiftType, weekDate) ||
    handoffs.filter(h => h.from_shift_type === shiftType || h.to_shift_type === shiftType);

  if (!details) {
    return (
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-lg w-full">
        <div className="p-6 text-center">
          <p className="text-slate-500">No details available for this shift type.</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-lg w-full max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className={cn(
        'px-6 py-5 text-white',
        details.color ? `bg-${details.color}-600` : 'bg-emerald-600'
      )} style={{ backgroundColor: getColorValue(details.color) }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{details.icon || '📋'}</span>
            <div>
              <h2 className="text-xl font-bold">
                {details.display_name || SHIFT_TYPE_NAMES[shiftType] || shiftType}
              </h2>
              {timeSlot && (
                <p className="text-white/80 text-sm mt-0.5">
                  {TIME_SLOT_NAMES[timeSlot]}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {details.description && (
          <p className="mt-2 text-white/90 text-sm">{details.description}</p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Location */}
        {details.location && (
          <section>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Location
            </h3>
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
              <span className="text-lg">📍</span>
              <div className="flex-1">
                <p className="font-medium text-slate-900">{details.location}</p>
                {details.location_url && (
                  <a
                    href={details.location_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-emerald-600 hover:text-emerald-700 mt-1 inline-block"
                  >
                    Open in Maps →
                  </a>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Timeline */}
        {details.timeline && details.timeline.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Timeline
            </h3>
            <div className="space-y-0 border-l-2 border-slate-200 ml-4">
              {details.timeline.map((item, idx) => (
                <div key={idx} className="relative pl-6 pb-4 last:pb-0">
                  {/* Dot */}
                  <span className="absolute left-[-5px] top-1 w-2 h-2 bg-emerald-500 rounded-full" />

                  <div className="flex items-start gap-3">
                    <span className="font-mono text-sm text-slate-500 min-w-[60px]">
                      {item.time || '•'}
                    </span>
                    <p className="text-slate-700 flex-1">{item.task}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Checklist */}
        {details.checklist && details.checklist.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              What to Bring
            </h3>
            <div className="space-y-2">
              {details.checklist.map((item, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg',
                    item.required ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'
                  )}
                >
                  <span className={item.required ? 'text-amber-500' : 'text-slate-400'}>
                    {item.required ? '⚠️' : '☐'}
                  </span>
                  <span className={cn(
                    'text-sm',
                    item.required ? 'font-medium text-amber-800' : 'text-slate-600'
                  )}>
                    {item.item}
                    {item.required && <span className="text-amber-600 text-xs ml-1">(Required)</span>}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Handoffs */}
        {relatedHandoffs.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Key Handoffs
            </h3>
            <div className="space-y-2">
              {relatedHandoffs.map(handoff => {
                const statusInfo = HANDOFF_STATUS_INFO[handoff.status];
                const isFrom = handoff.from_shift_type === shiftType;

                return (
                  <div
                    key={handoff.id}
                    className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg"
                  >
                    <span className="text-lg">🔑</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-amber-900 text-sm">
                        {isFrom ? 'Pass' : 'Receive'}: {handoff.item_name}
                      </p>
                      {handoff.notes && (
                        <p className="text-xs text-amber-700 mt-0.5 truncate">{handoff.notes}</p>
                      )}
                      <p className="text-xs text-amber-600 mt-1">
                        {isFrom && handoff.to_volunteer && (
                          <>To: {handoff.to_volunteer.display_name}</>
                        )}
                        {!isFrom && handoff.from_volunteer && (
                          <>From: {handoff.from_volunteer.display_name}</>
                        )}
                      </p>
                    </div>
                    <span className={cn(
                      'px-2 py-1 text-xs font-medium rounded-full',
                      handoff.status === 'completed' && 'bg-green-100 text-green-800',
                      handoff.status === 'confirmed' && 'bg-blue-100 text-blue-800',
                      handoff.status === 'pending' && 'bg-amber-200 text-amber-800'
                    )}>
                      {statusInfo.icon}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Full Content (Markdown) */}
        {details.content && (
          <section>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Full Instructions
            </h3>
            <div className="prose prose-sm prose-slate max-w-none">
              {/* Simple markdown-like rendering */}
              {details.content.split('\n').map((line, idx) => {
                if (line.startsWith('# ')) {
                  return <h4 key={idx} className="font-bold text-slate-900 mt-4">{line.slice(2)}</h4>;
                }
                if (line.startsWith('## ')) {
                  return <h5 key={idx} className="font-semibold text-slate-800 mt-3">{line.slice(3)}</h5>;
                }
                if (line.startsWith('- ')) {
                  return <li key={idx} className="ml-4 text-slate-700">{line.slice(2)}</li>;
                }
                if (line.trim() === '') {
                  return <br key={idx} />;
                }
                return <p key={idx} className="text-slate-700">{line}</p>;
              })}
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
        <Link
          to="/ops/guide"
          className="text-sm text-slate-500 hover:text-emerald-600"
        >
          View all guides
        </Link>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
};

// Helper to get actual color value for inline styles
function getColorValue(colorName?: string): string {
  const colors: Record<string, string> = {
    slate: '#475569',
    green: '#16a34a',
    emerald: '#059669',
    blue: '#2563eb',
    cyan: '#0891b2',
    orange: '#ea580c',
    amber: '#d97706',
  };
  return colors[colorName || 'emerald'] || colors.emerald;
}

export default ShiftDetailPanel;
