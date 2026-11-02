import React from 'react';
import { useOpsStore } from '@/services/opsState';
import {
  type Handoff,
  type HandoffItemType,
  HANDOFF_TYPE_INFO,
  HANDOFF_STATUS_INFO,
  TIME_SLOT_NAMES,
} from '@/types/ops';
import { cn } from '@/lib/utils';

interface HandoffChainProps {
  weekDate?: string;
  itemType?: HandoffItemType;
  compact?: boolean;
  showAllItems?: boolean;
}

/**
 * Visualizes the handoff chain for keys/equipment
 * Shows: Alex (Thu 6pm) → Morgan (Thu 8pm) → Taylor (Fri 12pm)
 *             ✓              ✓               ⏳
 */
export const HandoffChain: React.FC<HandoffChainProps> = ({
  weekDate,
  itemType,
  compact = false,
  showAllItems: _showAllItems = true,
}) => {
  const { handoffs, selectedWeek, currentVolunteer } = useOpsStore();

  // Filter handoffs for the given week
  const weekHandoffs = handoffs.filter(
    h => h.week_date === (weekDate || selectedWeek)
  );

  // Group handoffs by item
  const handoffsByItem = weekHandoffs.reduce((acc, handoff) => {
    const key = handoff.item_name;
    if (!acc[key]) {
      acc[key] = {
        itemType: handoff.item_type,
        itemName: handoff.item_name,
        chain: [],
      };
    }
    acc[key].chain.push(handoff);
    return acc;
  }, {} as Record<string, { itemType: HandoffItemType; itemName: string; chain: Handoff[] }>);

  // Sort each chain by time slot (simple sort by slot name for now)
  Object.values(handoffsByItem).forEach(item => {
    item.chain.sort((a, b) => {
      const timeOrder: Record<string, number> = {
        thursday_evening: 0,
        friday_am: 1,
        friday_noon: 2,
        friday_pm: 3,
        saturday_am: 4,
        saturday_noon: 5,
        saturday_pm: 6,
        saturday_evening: 7,
        sunday_afternoon: 8,
      };
      const aTime = timeOrder[a.handoff_time || ''] ?? 99;
      const bTime = timeOrder[b.handoff_time || ''] ?? 99;
      return aTime - bTime;
    });
  });

  // Filter to specific item type if provided
  const items = Object.values(handoffsByItem).filter(
    item => !itemType || item.itemType === itemType
  );

  if (items.length === 0) {
    if (compact) return null;
    return (
      <div className="text-center py-4 text-slate-400 text-sm">
        No handoffs scheduled for this week
      </div>
    );
  }

  if (compact) {
    // Compact view - just show item names with status
    return (
      <div className="flex flex-wrap gap-2">
        {items.map(item => {
          const typeInfo = HANDOFF_TYPE_INFO[item.itemType];
          const allCompleted = item.chain.every(h => h.status === 'completed');
          const hasPending = item.chain.some(h => h.status === 'pending');

          return (
            <span
              key={item.itemName}
              className={cn(
                'inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm',
                allCompleted && 'bg-green-100 text-green-700',
                hasPending && 'bg-amber-100 text-amber-700',
                !allCompleted && !hasPending && 'bg-blue-100 text-blue-700'
              )}
            >
              <span>{typeInfo.icon}</span>
              {item.itemName}
              <span className="text-xs">
                {allCompleted ? '✅' : hasPending ? '⏳' : '→'}
              </span>
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map(item => {
        const typeInfo = HANDOFF_TYPE_INFO[item.itemType];

        return (
          <div
            key={item.itemName}
            className="bg-white rounded-xl border border-slate-200 overflow-hidden"
          >
            {/* Item header */}
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
              <span className="text-lg">{typeInfo.icon}</span>
              <h3 className="font-semibold text-amber-900">{item.itemName}</h3>
              <span className="text-xs text-amber-600 ml-auto">
                {item.chain.length} handoff{item.chain.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Chain visualization */}
            <div className="p-4">
              <div className="flex items-center gap-1 overflow-x-auto pb-2">
                {item.chain.map((handoff, idx) => {
                  const statusInfo = HANDOFF_STATUS_INFO[handoff.status];
                  const isCurrentVolunteer =
                    currentVolunteer?.id === handoff.from_volunteer_id ||
                    currentVolunteer?.id === handoff.to_volunteer_id;

                  return (
                    <React.Fragment key={handoff.id}>
                      {/* From volunteer */}
                      {idx === 0 && handoff.from_volunteer && (
                        <>
                          <div
                            className={cn(
                              'flex flex-col items-center min-w-[80px]',
                              isCurrentVolunteer && currentVolunteer?.id === handoff.from_volunteer_id && 'ring-2 ring-emerald-400 ring-offset-2 rounded-lg'
                            )}
                          >
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-lg font-semibold text-slate-600">
                              {handoff.from_volunteer.display_name.charAt(0)}
                            </div>
                            <p className="text-xs font-medium text-slate-900 mt-1 text-center">
                              {handoff.from_volunteer.display_name}
                            </p>
                            {handoff.handoff_time && (
                              <p className="text-[10px] text-slate-400">
                                {TIME_SLOT_NAMES[handoff.handoff_time]}
                              </p>
                            )}
                          </div>

                          {/* Arrow with status */}
                          <div className="flex flex-col items-center px-2">
                            <div
                              className={cn(
                                'w-8 h-0.5',
                                handoff.status === 'completed' && 'bg-green-500',
                                handoff.status === 'confirmed' && 'bg-blue-500',
                                handoff.status === 'pending' && 'bg-amber-400'
                              )}
                            />
                            <span className="text-xs mt-0.5">{statusInfo.icon}</span>
                          </div>
                        </>
                      )}

                      {/* To volunteer */}
                      <div
                        className={cn(
                          'flex flex-col items-center min-w-[80px]',
                          isCurrentVolunteer && currentVolunteer?.id === handoff.to_volunteer_id && 'ring-2 ring-emerald-400 ring-offset-2 rounded-lg p-1'
                        )}
                      >
                        {handoff.to_volunteer ? (
                          <>
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-lg font-semibold text-slate-600">
                              {handoff.to_volunteer.display_name.charAt(0)}
                            </div>
                            <p className="text-xs font-medium text-slate-900 mt-1 text-center">
                              {handoff.to_volunteer.display_name}
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-lg font-semibold text-amber-600">
                              ?
                            </div>
                            <p className="text-xs font-medium text-amber-600 mt-1">
                              Unassigned
                            </p>
                          </>
                        )}
                      </div>

                      {/* Arrow to next in chain */}
                      {idx < item.chain.length - 1 && (
                        <div className="flex flex-col items-center px-2">
                          <div className="w-8 h-0.5 bg-slate-300" />
                          <span className="text-xs mt-0.5 text-slate-400">→</span>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Notes */}
              {item.chain.some(h => h.notes) && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  {item.chain.filter(h => h.notes).map(h => (
                    <p key={h.id} className="text-xs text-slate-500 flex items-start gap-2">
                      <span>💡</span>
                      <span>{h.notes}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default HandoffChain;
