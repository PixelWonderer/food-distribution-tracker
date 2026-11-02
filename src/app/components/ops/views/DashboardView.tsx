import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOpsStore } from '@/services/opsState';
import {
  formatWeekDate,
  getMonday,
  isShiftToday,
  getShiftDate,
  type ShiftAssignment,
  type TimeSlot,
  type ShiftType,
  type ActionItem,
  TIME_SLOT_NAMES,
  SHIFT_TYPE_NAMES,
  TIME_SLOT_COLORS,
  HANDOFF_STATUS_INFO,
} from '@/types/ops';
import { cn } from '@/lib/utils';
import { HandoffChain } from '../widgets/HandoffChain';

// Expected coverage for gap detection
const EXPECTED_COVERAGE: Partial<Record<TimeSlot, ShiftType[]>> = {
  thursday_evening: ['produce_market', 'truck_loading'],
  friday_noon: ['grocery_distribution'],
  saturday_noon: ['saturday_distribution'],
  saturday_evening: ['saturday_evening_run'],
  sunday_afternoon: ['sunday_distribution'],
};

/**
 * Dashboard View - The new landing page for Ops Hub
 * Shows at-a-glance information, personalized shifts, and coverage status
 */
const DashboardView: React.FC = () => {
  const {
    volunteers,
    shiftAssignments,
    selectedWeek,
    currentVolunteer,
    activeCoverageScenario,
    shiftDetails,
    handoffs,
    actionItems,
    fetchShifts,
    fetchShiftDetails,
    fetchHandoffs,
    fetchCoverageScenarios,
    fetchActionItems,
    updateActionItem,
    setCurrentVolunteer,
    isLoading,
  } = useOpsStore();

  // Fetch data on mount
  useEffect(() => {
    fetchShifts();
    fetchShiftDetails();
    fetchHandoffs();
    fetchCoverageScenarios();
    fetchActionItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek]);

  // Get today's date info
  const today = new Date();
  const isCurrentWeek = useMemo(() => {
    const currentMonday = getMonday(today);
    const selectedMonday = new Date(selectedWeek);
    currentMonday.setHours(0, 0, 0, 0);
    selectedMonday.setHours(0, 0, 0, 0);
    return currentMonday.getTime() === selectedMonday.getTime();
  }, [selectedWeek, today]);

  // Get today's shifts
  const todayShifts = useMemo(() => {
    if (!isCurrentWeek) return [];
    return shiftAssignments.filter(s => isShiftToday(s.time_slot, selectedWeek));
  }, [shiftAssignments, selectedWeek, isCurrentWeek]);

  // Get my shifts this week
  const myShifts = useMemo(() => {
    if (!currentVolunteer) return [];
    return shiftAssignments
      .filter(s => s.volunteer_id === currentVolunteer.id)
      .sort((a, b) => {
        const dateA = getShiftDate(a.time_slot, selectedWeek);
        const dateB = getShiftDate(b.time_slot, selectedWeek);
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
      });
  }, [shiftAssignments, currentVolunteer, selectedWeek]);

  // Get my handoffs
  const myHandoffs = useMemo(() => {
    if (!currentVolunteer) return [];
    return handoffs.filter(
      h => h.from_volunteer_id === currentVolunteer.id || h.to_volunteer_id === currentVolunteer.id
    );
  }, [handoffs, currentVolunteer]);

  // Pending handoffs (for alerts)
  const pendingHandoffs = useMemo(() => {
    return myHandoffs.filter(h => h.status === 'pending' || h.status === 'confirmed');
  }, [myHandoffs]);

  // Calculate coverage gaps
  const coverageGaps = useMemo(() => {
    const gaps: { timeSlot: TimeSlot; shiftType: ShiftType }[] = [];
    for (const [timeSlot, requiredTypes] of Object.entries(EXPECTED_COVERAGE)) {
      for (const shiftType of requiredTypes || []) {
        const hasVolunteer = shiftAssignments.some(
          s => s.time_slot === timeSlot && s.shift_type === shiftType
        );
        if (!hasVolunteer) {
          gaps.push({ timeSlot: timeSlot as TimeSlot, shiftType });
        }
      }
    }
    return gaps;
  }, [shiftAssignments]);

  // Group action items by deadline
  const groupedActionItems = useMemo(() => {
    const incomplete = actionItems.filter(item => !item.is_completed);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Calculate end of selected week (Sunday)
    const weekEnd = new Date(selectedWeek);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const overdue: ActionItem[] = [];
    const todayItems: ActionItem[] = [];
    const thisWeek: ActionItem[] = [];
    const later: ActionItem[] = [];
    const noDueDate: ActionItem[] = [];

    for (const item of incomplete) {
      if (!item.due_date) {
        noDueDate.push(item);
        continue;
      }

      const dueDate = new Date(item.due_date);
      dueDate.setHours(23, 59, 59, 999);

      if (dueDate < todayStart) {
        overdue.push(item);
      } else if (dueDate <= todayEnd) {
        todayItems.push(item);
      } else if (dueDate <= weekEnd) {
        thisWeek.push(item);
      } else {
        later.push(item);
      }
    }

    // Sort each group by priority (higher first) then due date
    const sortItems = (items: ActionItem[]) => {
      return items.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        if (a.due_date && b.due_date) {
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }
        return 0;
      });
    };

    return {
      overdue: sortItems(overdue),
      today: sortItems(todayItems),
      thisWeek: sortItems(thisWeek),
      later: sortItems(later),
      noDueDate: sortItems(noDueDate),
      total: incomplete.length,
    };
  }, [actionItems, selectedWeek]);

  // Get shift details for a type
  const getDetails = (shiftType: ShiftType) => {
    return shiftDetails.find(sd => sd.shift_type === shiftType);
  };

  // Format shift date for display
  const formatShiftDate = (shift: ShiftAssignment) => {
    const date = getShiftDate(shift.time_slot, selectedWeek);
    if (!date) return '';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Emergency Coverage Banner */}
      {activeCoverageScenario && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-amber-900">{activeCoverageScenario.name}</h3>
              {activeCoverageScenario.description && (
                <p className="text-amber-800 text-sm mt-1">{activeCoverageScenario.description}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Welcome / Identity Prompt */}
      {!currentVolunteer ? (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
          <div className="text-center mb-4">
            <span className="text-4xl">👋</span>
            <h2 className="text-xl font-bold text-green-900 mt-3">Welcome to Ops Hub</h2>
            <p className="text-green-700 mt-2">
              Who are you? Select your name to see your personalized schedule.
            </p>
          </div>

          {/* Volunteer buttons */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {volunteers.map(vol => (
              <button
                key={vol.id}
                onClick={() => setCurrentVolunteer(vol.slug)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  'bg-white border border-green-200 text-green-800',
                  'hover:bg-green-100 hover:border-green-300 hover:shadow-sm',
                  'active:scale-95'
                )}
              >
                <span className="w-6 h-6 rounded-full bg-green-200 flex items-center justify-center text-xs font-semibold text-green-700">
                  {vol.display_name.charAt(0)}
                </span>
                {vol.display_name}
              </button>
            ))}
          </div>

          {volunteers.length === 0 && !isLoading && (
            <p className="text-center text-green-600 text-sm mt-4">
              Loading volunteers...
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Personalized Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Hey, {currentVolunteer.display_name}! 👋
              </h1>
              <p className="text-slate-500 mt-1">
                {isCurrentWeek ? "Here's your week at a glance" : `Week of ${formatWeekDate(selectedWeek)}`}
              </p>
            </div>
          </div>

          {/* My Shifts This Week */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <span>📅</span> My Shifts This Week
              </h2>
              <span className="text-sm text-slate-500">{myShifts.length} shift{myShifts.length !== 1 ? 's' : ''}</span>
            </div>

            {myShifts.length === 0 ? (
              <div className="bg-slate-50 rounded-xl p-6 text-center">
                <span className="text-3xl">🏖️</span>
                <p className="text-slate-600 mt-2">No shifts scheduled this week</p>
                <Link
                  to="/ops/overview"
                  className="text-green-600 hover:text-green-700 text-sm font-medium mt-2 inline-block"
                >
                  View full schedule →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {myShifts.map(shift => {
                  const details = getDetails(shift.shift_type);
                  const isToday = isShiftToday(shift.time_slot, selectedWeek);
                  const color = shift.time_slot ? TIME_SLOT_COLORS[shift.time_slot] : 'slate';

                  return (
                    <div
                      key={shift.id}
                      className={cn(
                        'bg-white rounded-xl border p-4 transition-all',
                        isToday
                          ? 'border-green-300 ring-2 ring-green-100'
                          : 'border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Icon */}
                          <div
                            className={cn(
                              'w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0',
                              `bg-${color}-100`
                            )}
                          >
                            {details?.icon || '📋'}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-slate-900 truncate">
                                {SHIFT_TYPE_NAMES[shift.shift_type] || shift.shift_type}
                              </h3>
                              {isToday && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                  TODAY
                                </span>
                              )}
                              {shift.is_confirmed && (
                                <span className="text-green-600">✓</span>
                              )}
                            </div>

                            <p className="text-sm text-slate-500 mt-0.5">
                              {formatShiftDate(shift)} • {shift.time_slot ? TIME_SLOT_NAMES[shift.time_slot] : ''}
                            </p>

                            {/* Timeline Preview */}
                            {details?.timeline && details.timeline.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {details.timeline.slice(0, 2).map((item, idx) => (
                                  <div key={idx} className="flex items-start gap-2 text-sm">
                                    <span className="text-slate-400 font-mono text-xs min-w-[60px]">
                                      {item.time || '•'}
                                    </span>
                                    <span className="text-slate-600">{item.task}</span>
                                  </div>
                                ))}
                                {details.timeline.length > 2 && (
                                  <p className="text-xs text-slate-400 pl-[68px]">
                                    +{details.timeline.length - 2} more steps
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* View Details */}
                        <Link
                          to={`/ops/volunteer/${currentVolunteer.slug}`}
                          className="text-slate-400 hover:text-slate-600 p-1"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Handoff Alerts */}
          {pendingHandoffs.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <span>🔑</span> Key Handoffs
              </h2>

              <div className="space-y-2">
                {pendingHandoffs.map(handoff => {
                  const isReceiving = handoff.to_volunteer_id === currentVolunteer.id;
                  const otherVolunteer = isReceiving
                    ? handoff.from_volunteer
                    : handoff.to_volunteer;
                  const statusInfo = HANDOFF_STATUS_INFO[handoff.status];

                  return (
                    <div
                      key={handoff.id}
                      className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3"
                    >
                      <span className="text-xl">🔑</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-amber-900">
                          {isReceiving ? 'Receive' : 'Pass'} {handoff.item_name}
                          {otherVolunteer && (
                            <> {isReceiving ? 'from' : 'to'} <strong>{otherVolunteer.display_name}</strong></>
                          )}
                        </p>
                        {handoff.notes && (
                          <p className="text-xs text-amber-700 mt-0.5">{handoff.notes}</p>
                        )}
                      </div>
                      <span className={cn(
                        'px-2 py-1 text-xs font-medium rounded-full',
                        handoff.status === 'pending' && 'bg-amber-200 text-amber-800',
                        handoff.status === 'confirmed' && 'bg-blue-100 text-blue-800'
                      )}>
                        {statusInfo.icon} {statusInfo.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {/* Today's Activity (if current week) */}
      {isCurrentWeek && todayShifts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <span>🌟</span> Happening Today
          </h2>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
            <div className="space-y-3">
              {todayShifts.map(shift => {
                const details = getDetails(shift.shift_type);
                return (
                  <div key={shift.id} className="flex items-center gap-3">
                    <span className="text-lg">{details?.icon || '📋'}</span>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">
                        {SHIFT_TYPE_NAMES[shift.shift_type]}
                      </p>
                      <p className="text-sm text-slate-600">
                        {shift.volunteer?.display_name || 'Unassigned'}
                        {shift.is_confirmed && <span className="text-green-600 ml-1">✓</span>}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500">
                      {shift.time_slot ? TIME_SLOT_NAMES[shift.time_slot] : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Key Handoffs This Week */}
      {handoffs.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <span>🔑</span> Key Handoffs This Week
          </h2>
          <HandoffChain />
        </section>
      )}

      {/* Coverage Gaps Warning */}
      {coverageGaps.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <span>⚠️</span> Coverage Needed
          </h2>

          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-700 mb-3">
              The following shifts need volunteers this week:
            </p>
            <div className="flex flex-wrap gap-2">
              {coverageGaps.map((gap, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-red-100 text-red-800 rounded-lg text-sm"
                >
                  {TIME_SLOT_NAMES[gap.timeSlot]}: {SHIFT_TYPE_NAMES[gap.shiftType]}
                </span>
              ))}
            </div>
            <Link
              to="/ops/schedule"
              className="text-red-600 hover:text-red-700 text-sm font-medium mt-3 inline-block"
            >
              Manage schedule →
            </Link>
          </div>
        </section>
      )}

      {/* Action Items Section */}
      {groupedActionItems.total > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <span>📋</span> Action Items
            </h2>
            <span className="text-sm text-slate-500">
              {groupedActionItems.total} pending
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Overdue Items */}
            {groupedActionItems.overdue.length > 0 && (
              <ActionItemGroup
                title="⚠️ Overdue"
                items={groupedActionItems.overdue}
                bgColor="bg-red-50"
                titleColor="text-red-800"
                onToggle={updateActionItem}
              />
            )}

            {/* Today's Items */}
            {groupedActionItems.today.length > 0 && (
              <ActionItemGroup
                title="📍 Today"
                items={groupedActionItems.today}
                bgColor="bg-amber-50"
                titleColor="text-amber-800"
                onToggle={updateActionItem}
              />
            )}

            {/* This Week Items */}
            {groupedActionItems.thisWeek.length > 0 && (
              <ActionItemGroup
                title="📅 This Week"
                items={groupedActionItems.thisWeek}
                bgColor="bg-blue-50"
                titleColor="text-blue-800"
                onToggle={updateActionItem}
              />
            )}

            {/* Later Items */}
            {groupedActionItems.later.length > 0 && (
              <ActionItemGroup
                title="🗓️ Later"
                items={groupedActionItems.later}
                bgColor="bg-slate-50"
                titleColor="text-slate-600"
                onToggle={updateActionItem}
              />
            )}

            {/* No Due Date Items */}
            {groupedActionItems.noDueDate.length > 0 && (
              <ActionItemGroup
                title="📝 No Due Date"
                items={groupedActionItems.noDueDate}
                bgColor="bg-slate-50"
                titleColor="text-slate-500"
                onToggle={updateActionItem}
              />
            )}
          </div>
        </section>
      )}

      {/* Quick Links */}
      <section className="grid grid-cols-2 gap-3">
        <Link
          to="/ops/overview"
          className="bg-slate-100 hover:bg-slate-200 rounded-xl p-4 text-center transition-colors"
        >
          <span className="text-2xl">📅</span>
          <p className="font-medium text-slate-900 mt-2">Full Schedule</p>
          <p className="text-xs text-slate-500">View all volunteers</p>
        </Link>
        <Link
          to="/ops/guide"
          className="bg-slate-100 hover:bg-slate-200 rounded-xl p-4 text-center transition-colors"
        >
          <span className="text-2xl">📚</span>
          <p className="font-medium text-slate-900 mt-2">Knowledge Base</p>
          <p className="text-xs text-slate-500">Procedures & guides</p>
        </Link>
      </section>

      {/* Loading State */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center z-50">
          <div className="animate-spin w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  );
};

// Action Item Group Component
interface ActionItemGroupProps {
  title: string;
  items: ActionItem[];
  bgColor: string;
  titleColor: string;
  onToggle: (itemId: string, updates: Partial<ActionItem>) => Promise<void>;
}

const ActionItemGroup: React.FC<ActionItemGroupProps> = ({
  title,
  items,
  bgColor,
  titleColor,
  onToggle,
}) => {
  const [expanded, setExpanded] = useState(true);

  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getPriorityLabel = (priority: number) => {
    if (priority >= 3) return { label: 'High', color: 'bg-red-100 text-red-700' };
    if (priority >= 2) return { label: 'Medium', color: 'bg-amber-100 text-amber-700' };
    return { label: 'Low', color: 'bg-slate-100 text-slate-600' };
  };

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      {/* Group Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-full px-4 py-2.5 flex items-center justify-between',
          bgColor
        )}
      >
        <span className={cn('font-medium text-sm', titleColor)}>
          {title}
          <span className="ml-2 text-xs opacity-70">({items.length})</span>
        </span>
        <svg
          className={cn(
            'w-4 h-4 transition-transform',
            titleColor,
            expanded ? 'rotate-180' : ''
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Items */}
      {expanded && (
        <div className="divide-y divide-slate-100">
          {items.map(item => {
            const priority = getPriorityLabel(item.priority);
            return (
              <div
                key={item.id}
                className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors"
              >
                {/* Checkbox */}
                <button
                  onClick={() => onToggle(item.id, { is_completed: true })}
                  className="mt-0.5 w-5 h-5 rounded border-2 border-slate-300 flex-shrink-0 hover:border-green-500 hover:bg-green-50 transition-colors flex items-center justify-center"
                  title="Mark as complete"
                >
                  <svg
                    className="w-3 h-3 text-slate-300 group-hover:text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm">{item.title}</p>
                  {item.description && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    {item.assignee && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-medium">
                          {item.assignee.display_name.charAt(0)}
                        </span>
                        {item.assignee.display_name}
                      </span>
                    )}
                    {item.due_date && (
                      <span className="text-xs text-slate-400">
                        Due: {formatDueDate(item.due_date)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Priority Badge */}
                <span className={cn(
                  'px-1.5 py-0.5 text-[10px] font-medium rounded flex-shrink-0',
                  priority.color
                )}>
                  {priority.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DashboardView;
