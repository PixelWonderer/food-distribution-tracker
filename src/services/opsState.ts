import { create } from 'zustand';
import type {
  OpsState,
  Volunteer,
  KBArticle,
  ShiftAssignment,
  ShiftChangeLogEntry,
  ActionItem,
  KBCategory,
  ShiftDetails,
  Handoff,
  HandoffStatus,
  CoverageScenario,
  ShiftType,
} from '@/types/ops';
import { getMonday } from '@/types/ops';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from './supabaseService';
import { logger } from '@/lib/logger';

// Anon can read only these volunteer columns; email, phone and notes stay private (see the end of supabase/anon-access.sql)
const VOLUNTEER_COLUMNS = 'id, slug, display_name, is_active, created_at';

// Use the shared singleton client to avoid "Multiple GoTrueClient instances" warning
// Cast to untyped SupabaseClient (ops tables aren't in generated DB types)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: SupabaseClient<any> = SupabaseService.getInstance().getClient() as SupabaseClient<any>;

// Shift change log types (using simpler type for insert operations)
type ShiftChangeAction = 'created' | 'updated' | 'deleted' | 'confirmed' | 'unconfirmed' | 'transferred' | 'copied';

interface ShiftChangeLogInsert {
  shift_id?: string;
  week_date: string;
  action: ShiftChangeAction;
  previous_volunteer_id?: string;
  previous_volunteer_name?: string;
  new_volunteer_id?: string;
  new_volunteer_name?: string;
  shift_type?: string;
  time_slot?: string;
  changed_by_volunteer_id?: string;
  changed_by_name?: string;
  notes?: string;
}

// Helper to log shift changes
async function logShiftChange(entry: ShiftChangeLogInsert, currentVolunteer?: { id: string; display_name: string } | null) {
  try {
    await supabase.from('shift_change_log').insert({
      ...entry,
      changed_by_volunteer_id: currentVolunteer?.id,
      changed_by_name: currentVolunteer?.display_name,
    });
  } catch (err) {
    console.error('Failed to log shift change:', err);
    // Don't throw - logging failures shouldn't break the main operation
  }
}

// Cookie helpers
const VOLUNTEER_COOKIE = 'tracker_volunteer';

function getVolunteerCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${VOLUNTEER_COOKIE}=([^;]+)`));
  return match ? match[2] : null;
}

function setVolunteerCookie(slug: string): void {
  // Set cookie for 1 year
  document.cookie = `${VOLUNTEER_COOKIE}=${slug}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

function clearVolunteerCookie(): void {
  document.cookie = `${VOLUNTEER_COOKIE}=; path=/; max-age=0`;
}

export const useOpsStore = create<OpsState>((set, get) => ({
  // Initial state
  currentVolunteer: null,
  volunteers: [],
  articles: [],
  shiftAssignments: [],
  actionItems: [],
  shiftChangeLog: [],

  // NEW: Rich shift details and coordination data
  shiftDetails: [],
  handoffs: [],
  coverageScenarios: [],
  activeCoverageScenario: null,

  selectedWeek: getMonday(new Date()).toISOString().split('T')[0],
  sidebarOpen: true,
  isLoading: false,
  error: null,

  // Set current volunteer (saves to cookie)
  setCurrentVolunteer: (slug: string) => {
    const volunteer = get().volunteers.find(v => v.slug === slug);
    if (volunteer) {
      set({ currentVolunteer: volunteer });
      setVolunteerCookie(slug);
    }
  },

  // Clear current volunteer
  clearCurrentVolunteer: () => {
    set({ currentVolunteer: null });
    clearVolunteerCookie();
  },

  // Fetch all volunteers
  fetchVolunteers: async () => {
    try {
      set({ isLoading: true, error: null });

      const { data, error } = await supabase
        .from('volunteers')
        .select(VOLUNTEER_COLUMNS)
        .eq('is_active', true)
        .order('display_name');

      if (error) throw error;

      const volunteers = (data as Volunteer[]) || [];
      set({ volunteers });

      // Restore volunteer from cookie if exists
      const savedSlug = getVolunteerCookie();
      if (savedSlug && !get().currentVolunteer) {
        const saved = volunteers.find(v => v.slug === savedSlug);
        if (saved) {
          set({ currentVolunteer: saved });
        }
      }
    } catch (err) {
      console.error('Failed to fetch volunteers:', err);
      set({ error: 'Failed to load volunteers' });
    } finally {
      set({ isLoading: false });
    }
  },

  // Fetch knowledge base articles
  fetchArticles: async (category?: KBCategory) => {
    // Guard against concurrent fetches
    if (get().isLoading) return;

    try {
      set({ isLoading: true, error: null });

      let query = supabase
        .from('kb_articles')
        .select('*')
        .eq('is_published', true)
        .order('display_order')
        .order('title');

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) throw error;

      set({ articles: (data as KBArticle[]) || [] });
    } catch (err) {
      console.error('Failed to fetch articles:', err);
      set({ error: 'Failed to load knowledge base' });
    } finally {
      set({ isLoading: false });
    }
  },

  // Fetch single article by slug
  fetchArticleBySlug: async (slug: string) => {
    try {
      const { data, error } = await supabase
        .from('kb_articles')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .single();

      if (error) throw error;

      return data as KBArticle;
    } catch (err) {
      console.error('Failed to fetch article:', err);
      return null;
    }
  },

  // Fetch shift assignments for a week
  fetchShifts: async (weekDate?: string) => {
    const week = weekDate || get().selectedWeek;

    try {
      set({ isLoading: true, error: null });

      const { data, error } = await supabase
        .from('shift_assignments')
        .select(`
          *,
          volunteer:volunteers(${VOLUNTEER_COLUMNS})
        `)
        .eq('week_date', week);

      if (error) throw error;

      set({ shiftAssignments: (data as ShiftAssignment[]) || [] });
    } catch (err) {
      console.error('Failed to fetch shifts:', err);
      set({ error: 'Failed to load schedule' });
    } finally {
      set({ isLoading: false });
    }
  },

  // Fetch action items
  fetchActionItems: async (weekDate?: string) => {
    try {
      set({ isLoading: true, error: null });

      let query = supabase
        .from('action_items')
        .select('*')
        .order('priority', { ascending: false })
        .order('due_date');

      if (weekDate) {
        query = query.eq('week_date', weekDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Manually attach assignee info from volunteers list
      const volunteers = get().volunteers;
      const itemsWithAssignees = (data || []).map(item => ({
        ...item,
        assignee: item.assigned_to ? volunteers.find(v => v.id === item.assigned_to) : undefined,
      }));

      set({ actionItems: itemsWithAssignees as ActionItem[] });
    } catch (err) {
      console.error('Failed to fetch action items:', err);
      set({ error: 'Failed to load action items' });
    } finally {
      set({ isLoading: false });
    }
  },

  // Update shift assignment
  updateShiftAssignment: async (shiftId: string, updates: Partial<import('@/types/ops').ShiftAssignment>) => {
    try {
      const { error } = await supabase
        .from('shift_assignments')
        .update(updates)
        .eq('id', shiftId);

      if (error) throw error;

      // Refresh shifts to get updated data with volunteer info
      await get().fetchShifts();
    } catch (err) {
      console.error('Failed to update shift:', err);
      throw err;
    }
  },

  // Request shift swap (placeholder - just transfers for now)
  requestShiftSwap: async (shiftId: string, targetVolunteerId: string) => {
    const shift = get().shiftAssignments.find(s => s.id === shiftId);
    const volunteers = get().volunteers;
    const currentVolunteer = get().currentVolunteer;
    const targetVolunteer = volunteers.find(v => v.id === targetVolunteerId);

    // For now, this just does a direct transfer
    // In a full implementation, this would create a swap request that the other volunteer approves
    await get().updateShiftAssignment(shiftId, { volunteer_id: targetVolunteerId });

    // Log the transfer
    if (shift) {
      await logShiftChange({
        shift_id: shiftId,
        week_date: shift.week_date,
        action: 'transferred',
        previous_volunteer_id: shift.volunteer_id,
        previous_volunteer_name: shift.volunteer?.display_name,
        new_volunteer_id: targetVolunteerId,
        new_volunteer_name: targetVolunteer?.display_name,
        shift_type: shift.shift_type,
        time_slot: shift.time_slot,
      }, currentVolunteer);
    }
  },

  // Toggle shift confirmation status
  toggleShiftConfirmation: async (shiftId: string) => {
    const shift = get().shiftAssignments.find(s => s.id === shiftId);
    if (!shift) return;

    const newStatus = !shift.is_confirmed;
    const currentVolunteer = get().currentVolunteer;

    // Optimistic update
    set(state => ({
      shiftAssignments: state.shiftAssignments.map(s =>
        s.id === shiftId ? { ...s, is_confirmed: newStatus } : s
      ),
    }));

    try {
      const { error } = await supabase
        .from('shift_assignments')
        .update({ is_confirmed: newStatus })
        .eq('id', shiftId);

      if (error) throw error;

      // Log the confirmation change
      await logShiftChange({
        shift_id: shiftId,
        week_date: shift.week_date,
        action: newStatus ? 'confirmed' : 'unconfirmed',
        new_volunteer_id: shift.volunteer_id,
        new_volunteer_name: shift.volunteer?.display_name,
        shift_type: shift.shift_type,
        time_slot: shift.time_slot,
      }, currentVolunteer);
    } catch (err) {
      // Revert on error
      set(state => ({
        shiftAssignments: state.shiftAssignments.map(s =>
          s.id === shiftId ? { ...s, is_confirmed: !newStatus } : s
        ),
        error: 'Failed to update shift',
      }));
      console.error('Failed to toggle shift confirmation:', err);
    }
  },

  // Create new shift assignment
  createShiftAssignment: async (shift) => {
    const currentVolunteer = get().currentVolunteer;
    const volunteers = get().volunteers;

    try {
      const { data, error } = await supabase
        .from('shift_assignments')
        .insert(shift)
        .select()
        .single();

      if (error) throw error;

      // Find the volunteer name for logging
      const assignedVolunteer = volunteers.find(v => v.id === shift.volunteer_id);

      // Log the creation
      await logShiftChange({
        shift_id: data?.id,
        week_date: shift.week_date,
        action: 'created',
        new_volunteer_id: shift.volunteer_id,
        new_volunteer_name: assignedVolunteer?.display_name,
        shift_type: shift.shift_type,
        time_slot: shift.time_slot,
      }, currentVolunteer);

      // Refresh shifts to get updated data with volunteer info
      await get().fetchShifts();
    } catch (err) {
      console.error('Failed to create shift:', err);
      throw err;
    }
  },

  // Delete shift assignment
  deleteShiftAssignment: async (shiftId: string) => {
    const shift = get().shiftAssignments.find(s => s.id === shiftId);
    const currentVolunteer = get().currentVolunteer;

    try {
      const { error } = await supabase
        .from('shift_assignments')
        .delete()
        .eq('id', shiftId);

      if (error) throw error;

      // Log the deletion (before removing from state)
      if (shift) {
        await logShiftChange({
          shift_id: shiftId,
          week_date: shift.week_date,
          action: 'deleted',
          previous_volunteer_id: shift.volunteer_id,
          previous_volunteer_name: shift.volunteer?.display_name,
          shift_type: shift.shift_type,
          time_slot: shift.time_slot,
        }, currentVolunteer);
      }

      // Remove from local state
      set(state => ({
        shiftAssignments: state.shiftAssignments.filter(s => s.id !== shiftId),
      }));
    } catch (err) {
      console.error('Failed to delete shift:', err);
      throw err;
    }
  },

  // Copy shifts from one week to another
  copyShiftsFromWeek: async (sourceWeek: string, targetWeek: string, clearExisting = false) => {
    const currentVolunteer = get().currentVolunteer;

    try {
      // Fetch shifts from source week
      const { data: sourceShifts, error: fetchError } = await supabase
        .from('shift_assignments')
        .select('volunteer_id, shift_type, time_slot, notes')
        .eq('week_date', sourceWeek);

      if (fetchError) throw fetchError;
      if (!sourceShifts || sourceShifts.length === 0) {
        return { copied: 0, message: 'No shifts found in source week' };
      }

      // Optionally clear existing shifts in target week
      if (clearExisting) {
        const { error: deleteError } = await supabase
          .from('shift_assignments')
          .delete()
          .eq('week_date', targetWeek);

        if (deleteError) throw deleteError;
      }

      // Create new shifts with target week date, all unconfirmed
      const newShifts = sourceShifts.map(shift => ({
        volunteer_id: shift.volunteer_id,
        week_date: targetWeek,
        shift_type: shift.shift_type,
        time_slot: shift.time_slot,
        notes: shift.notes,
        is_confirmed: false,
      }));

      const { error: insertError } = await supabase
        .from('shift_assignments')
        .insert(newShifts);

      if (insertError) throw insertError;

      // Log the copy action (single log entry for bulk copy)
      await logShiftChange({
        week_date: targetWeek,
        action: 'copied',
        notes: `Copied ${newShifts.length} shifts from week of ${sourceWeek}${clearExisting ? ' (replaced existing)' : ' (added to existing)'}`,
      }, currentVolunteer);

      // Refresh current week's shifts if we're viewing the target week
      if (get().selectedWeek === targetWeek) {
        await get().fetchShifts();
      }

      return { copied: newShifts.length, message: `Copied ${newShifts.length} shifts` };
    } catch (err) {
      console.error('Failed to copy shifts:', err);
      throw err;
    }
  },

  // Get shifts for a specific week without updating state (for preview)
  getShiftsForWeek: async (weekDate: string) => {
    try {
      const { data, error } = await supabase
        .from('shift_assignments')
        .select(`
          *,
          volunteer:volunteers(${VOLUNTEER_COLUMNS})
        `)
        .eq('week_date', weekDate);

      if (error) throw error;
      return (data as ShiftAssignment[]) || [];
    } catch (err) {
      console.error('Failed to fetch shifts for week:', err);
      return [];
    }
  },

  // Create new action item
  createActionItem: async (item) => {
    try {
      const { error } = await supabase.from('action_items').insert(item);

      if (error) throw error;

      // Refresh action items
      await get().fetchActionItems();
    } catch (err) {
      console.error('Failed to create action item:', err);
      throw err;
    }
  },

  // Update action item
  updateActionItem: async (itemId: string, updates) => {
    try {
      const { error } = await supabase
        .from('action_items')
        .update(updates)
        .eq('id', itemId);

      if (error) throw error;

      // Refresh action items
      await get().fetchActionItems();
    } catch (err) {
      console.error('Failed to update action item:', err);
      throw err;
    }
  },

  // Delete action item
  deleteActionItem: async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('action_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      // Remove from local state
      set(state => ({
        actionItems: state.actionItems.filter(i => i.id !== itemId),
      }));
    } catch (err) {
      console.error('Failed to delete action item:', err);
      throw err;
    }
  },

  // Fetch shift change log
  fetchShiftChangeLog: async (weekDate?: string) => {
    try {
      let query = supabase
        .from('shift_change_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (weekDate) {
        query = query.eq('week_date', weekDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      set({ shiftChangeLog: (data as ShiftChangeLogEntry[]) || [] });
    } catch (err) {
      console.error('Failed to fetch shift change log:', err);
      // Don't set error state - log viewing is not critical
    }
  },

  // Set selected week
  setSelectedWeek: (weekDate: string) => {
    set({ selectedWeek: weekDate });
    // Automatically fetch data for new week
    get().fetchShifts(weekDate);
    get().fetchActionItems(weekDate);
  },

  // Toggle sidebar
  toggleSidebar: () => {
    set(state => ({ sidebarOpen: !state.sidebarOpen }));
  },

  // Real-time subscription for shifts
  subscribeToShifts: () => {
    const channel = supabase
      .channel('shifts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shift_assignments',
        },
        (payload) => {
          logger.debug('Shift change received:', payload.eventType);
          // Refresh shifts when any change occurs
          // Filter to only refetch if it's for the currently selected week
          const selectedWeek = get().selectedWeek;
          if (
            payload.eventType === 'DELETE' ||
            (payload.new && (payload.new as { week_date?: string }).week_date === selectedWeek) ||
            (payload.old && (payload.old as { week_date?: string }).week_date === selectedWeek)
          ) {
            get().fetchShifts();
          }
        }
      )
      .subscribe((status) => {
        logger.debug('Shifts subscription status:', status);
      });

    // Store channel reference for cleanup
    (window as { __opsShiftsChannel?: typeof channel }).__opsShiftsChannel = channel;
  },

  // Real-time subscription for action items
  subscribeToActionItems: () => {
    const channel = supabase
      .channel('action-items-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'action_items',
        },
        (payload) => {
          logger.debug('Action item change received:', payload.eventType);
          // Refresh action items when any change occurs
          get().fetchActionItems();
        }
      )
      .subscribe((status) => {
        logger.debug('Action items subscription status:', status);
      });

    // Store channel reference for cleanup
    (window as { __opsActionItemsChannel?: typeof channel }).__opsActionItemsChannel = channel;
  },

  // ============================================
  // NEW: Rich Shift Details Actions
  // ============================================

  // Fetch all shift details (rich content for each shift type)
  fetchShiftDetails: async () => {
    try {
      const { data, error } = await supabase
        .from('shift_details')
        .select('*')
        .order('display_order');

      if (error) {
        // Table might not exist yet - this is expected during migration
        console.warn('Shift details table not available:', error.message);
        return;
      }

      set({ shiftDetails: (data as ShiftDetails[]) || [] });
    } catch (err) {
      console.error('Failed to fetch shift details:', err);
    }
  },

  // Get shift details for a specific type
  getShiftDetailsForType: (shiftType: ShiftType) => {
    return get().shiftDetails.find(sd => sd.shift_type === shiftType);
  },

  // Update shift details (coordinator only)
  updateShiftDetails: async (shiftType: ShiftType, updates: Partial<ShiftDetails>) => {
    try {
      const { error } = await supabase
        .from('shift_details')
        .upsert(
          { shift_type: shiftType, ...updates, updated_at: new Date().toISOString() },
          { onConflict: 'shift_type' }
        );

      if (error) throw error;
      await get().fetchShiftDetails();
    } catch (err) {
      console.error('Failed to update shift details:', err);
      throw err;
    }
  },

  // ============================================
  // NEW: Handoff Tracking Actions
  // ============================================

  // Fetch handoffs for a week
  fetchHandoffs: async (weekDate?: string) => {
    const week = weekDate || get().selectedWeek;
    try {
      const { data, error } = await supabase
        .from('handoffs')
        .select(`
          *,
          from_volunteer:volunteers!handoffs_from_volunteer_id_fkey(${VOLUNTEER_COLUMNS}),
          to_volunteer:volunteers!handoffs_to_volunteer_id_fkey(${VOLUNTEER_COLUMNS})
        `)
        .eq('week_date', week)
        .order('created_at');

      if (error) {
        // Table might not exist yet
        console.warn('Handoffs table not available:', error.message);
        return;
      }

      set({ handoffs: (data as Handoff[]) || [] });
    } catch (err) {
      console.error('Failed to fetch handoffs:', err);
    }
  },

  // Create a new handoff
  createHandoff: async (handoff: Omit<Handoff, 'id' | 'created_at' | 'from_volunteer' | 'to_volunteer'>) => {
    try {
      const { error } = await supabase.from('handoffs').insert(handoff);
      if (error) throw error;
      await get().fetchHandoffs(handoff.week_date);
    } catch (err) {
      console.error('Failed to create handoff:', err);
      throw err;
    }
  },

  // Update handoff status
  updateHandoffStatus: async (handoffId: string, status: HandoffStatus, notes?: string) => {
    try {
      const updates: { status: HandoffStatus; notes?: string } = { status };
      if (notes !== undefined) updates.notes = notes;

      const { error } = await supabase
        .from('handoffs')
        .update(updates)
        .eq('id', handoffId);

      if (error) throw error;
      await get().fetchHandoffs();
    } catch (err) {
      console.error('Failed to update handoff status:', err);
      throw err;
    }
  },

  // Delete a handoff
  deleteHandoff: async (handoffId: string) => {
    try {
      const { error } = await supabase.from('handoffs').delete().eq('id', handoffId);
      if (error) throw error;
      await get().fetchHandoffs();
    } catch (err) {
      console.error('Failed to delete handoff:', err);
      throw err;
    }
  },

  // Get handoffs involving a specific volunteer
  getHandoffsForVolunteer: (volunteerId: string) => {
    return get().handoffs.filter(
      h => h.from_volunteer_id === volunteerId || h.to_volunteer_id === volunteerId
    );
  },

  // Get handoffs for a specific shift
  getHandoffsForShift: (shiftType: ShiftType, weekDate: string) => {
    return get().handoffs.filter(
      h =>
        h.week_date === weekDate &&
        (h.from_shift_type === shiftType || h.to_shift_type === shiftType)
    );
  },

  // ============================================
  // NEW: Coverage Scenario Actions
  // ============================================

  // Fetch all coverage scenarios
  fetchCoverageScenarios: async () => {
    try {
      const { data, error } = await supabase
        .from('coverage_scenarios')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Coverage scenarios table not available:', error.message);
        return;
      }

      const scenarios = (data as CoverageScenario[]) || [];
      const active = scenarios.find(s => s.active) || null;
      set({ coverageScenarios: scenarios, activeCoverageScenario: active });
    } catch (err) {
      console.error('Failed to fetch coverage scenarios:', err);
    }
  },

  // Create a new coverage scenario
  createCoverageScenario: async (scenario: Omit<CoverageScenario, 'id' | 'created_at'>) => {
    try {
      const { error } = await supabase.from('coverage_scenarios').insert(scenario);
      if (error) throw error;
      await get().fetchCoverageScenarios();
    } catch (err) {
      console.error('Failed to create coverage scenario:', err);
      throw err;
    }
  },

  // Activate or deactivate a coverage scenario
  activateCoverageScenario: async (scenarioId: string | null) => {
    try {
      // First, deactivate all scenarios
      await supabase.from('coverage_scenarios').update({ active: false }).neq('id', '');

      // Then activate the selected one (if provided)
      if (scenarioId) {
        const { error } = await supabase
          .from('coverage_scenarios')
          .update({ active: true })
          .eq('id', scenarioId);
        if (error) throw error;
      }

      await get().fetchCoverageScenarios();
    } catch (err) {
      console.error('Failed to activate coverage scenario:', err);
      throw err;
    }
  },

  // Delete a coverage scenario
  deleteCoverageScenario: async (scenarioId: string) => {
    try {
      const { error } = await supabase.from('coverage_scenarios').delete().eq('id', scenarioId);
      if (error) throw error;
      await get().fetchCoverageScenarios();
    } catch (err) {
      console.error('Failed to delete coverage scenario:', err);
      throw err;
    }
  },

  // ============================================
  // Real-time Subscriptions
  // ============================================

  // Real-time subscription for handoffs
  subscribeToHandoffs: () => {
    const channel = supabase
      .channel('handoffs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'handoffs',
        },
        (payload) => {
          logger.debug('Handoff change received:', payload.eventType);
          get().fetchHandoffs();
        }
      )
      .subscribe((status) => {
        logger.debug('Handoffs subscription status:', status);
      });

    (window as { __opsHandoffsChannel?: typeof channel }).__opsHandoffsChannel = channel;
  },

  // Unsubscribe from all real-time channels
  unsubscribeAll: () => {
    const shiftsChannel = (window as { __opsShiftsChannel?: ReturnType<typeof supabase.channel> }).__opsShiftsChannel;
    const actionItemsChannel = (window as { __opsActionItemsChannel?: ReturnType<typeof supabase.channel> }).__opsActionItemsChannel;
    const handoffsChannel = (window as { __opsHandoffsChannel?: ReturnType<typeof supabase.channel> }).__opsHandoffsChannel;

    if (shiftsChannel) {
      supabase.removeChannel(shiftsChannel);
      logger.debug('Unsubscribed from shifts channel');
    }
    if (actionItemsChannel) {
      supabase.removeChannel(actionItemsChannel);
      logger.debug('Unsubscribed from action items channel');
    }
    if (handoffsChannel) {
      supabase.removeChannel(handoffsChannel);
      logger.debug('Unsubscribed from handoffs channel');
    }
  },
}));
