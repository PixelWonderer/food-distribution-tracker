/**
 * TypeScript types for the Ops Hub
 */

// Volunteer identity (no auth, cookie-based)
export interface Volunteer {
  id: string;
  slug: string;
  display_name: string;
  email?: string;
  phone?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

// Knowledge base article
export interface KBArticle {
  id: string;
  slug: string;
  title: string;
  content: string; // Markdown
  category: KBCategory;
  display_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export type KBCategory = 'procedures' | 'locations' | 'routes' | 'contacts' | 'general';

// Shift assignment
export interface ShiftAssignment {
  id: string;
  volunteer_id: string;
  week_date: string; // ISO date of Monday
  shift_type: ShiftType;
  time_slot?: TimeSlot;
  notes?: string;
  is_confirmed: boolean;
  created_at: string;
  // Joined data
  volunteer?: Volunteer;
}

export type ShiftType =
  | 'produce_market'
  | 'truck_loading'
  | 'grocery_distribution'
  | 'saturday_distribution'
  | 'saturday_evening_run'
  | 'sunday_distribution'
  // Legacy types
  | 'produce_market_thu'
  | 'grocery_fri'
  | 'distribution_fri'
  | 'timeless_fri'
  | 'grocery_sat'
  | 'distribution_sat'
  | 'evening_run_sat'
  | 'sunday_meal_sun'
  | 'distribution_sun';

export type TimeSlot =
  | 'thursday_evening'
  | 'friday_am'
  | 'friday_noon'
  | 'friday_pm'
  | 'saturday_am'
  | 'saturday_noon'
  | 'saturday_pm'
  | 'saturday_evening'
  | 'sunday_afternoon';

// Shift change log entry (audit trail)
export interface ShiftChangeLogEntry {
  id: string;
  shift_id?: string;
  week_date: string;
  action: 'created' | 'updated' | 'deleted' | 'confirmed' | 'unconfirmed' | 'transferred' | 'copied';
  previous_volunteer_id?: string;
  previous_volunteer_name?: string;
  new_volunteer_id?: string;
  new_volunteer_name?: string;
  shift_type?: string;
  time_slot?: string;
  changed_by_volunteer_id?: string;
  changed_by_name?: string;
  notes?: string;
  created_at: string;
}

// Action item (coordinator checklist)
export interface ActionItem {
  id: string;
  title: string;
  description?: string;
  week_date?: string;
  assigned_to?: string;
  is_completed: boolean;
  priority: number;
  due_date?: string;
  created_at: string;
  // Joined data
  assignee?: Volunteer;
}

// ============================================
// Rich Shift Details (Phase 1: Coordination Tool)
// ============================================

// Timeline item for shift details
export interface TimelineItem {
  time: string;    // e.g., "~6:30pm" or "7:00pm"
  task: string;    // e.g., "Pick up Jordan — grab refrigerated Produce Market stuff"
}

// Checklist item for shift details
export interface ChecklistItem {
  item: string;    // e.g., "2 tables"
  required: boolean;
}

// Rich content for each shift type
export interface ShiftDetails {
  id: string;
  shift_type: ShiftType;
  display_name: string;
  description?: string;           // Brief summary for cards
  content?: string;               // Full Markdown content
  timeline?: TimelineItem[];      // Step-by-step schedule
  checklist?: ChecklistItem[];    // Items to bring/tasks to complete
  location?: string;              // e.g., "Community Center, Main St"
  location_url?: string;          // Google Maps link
  icon?: string;                  // Emoji icon
  color?: string;                 // Tailwind color class (e.g., "slate", "green")
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

// ============================================
// Handoff Tracking (Phase 4: Key Transfers)
// ============================================

export type HandoffItemType = 'truck_key' | 'door_code' | 'warehouse_key' | 'equipment' | 'other';
export type HandoffStatus = 'pending' | 'confirmed' | 'completed';

// Key/equipment handoff between volunteers
export interface Handoff {
  id: string;
  week_date: string;              // ISO date of Monday
  item_type: HandoffItemType;
  item_name: string;              // e.g., "Truck Key", "Warehouse Door Code"
  from_volunteer_id?: string;
  to_volunteer_id?: string;
  from_shift_type?: ShiftType;    // Which shift the item comes from
  to_shift_type?: ShiftType;      // Which shift receives the item
  handoff_time?: TimeSlot;        // When the handoff happens
  status: HandoffStatus;
  notes?: string;                 // e.g., "Leave key in truck cab, near cup holders, covered"
  created_at: string;
  // Joined data
  from_volunteer?: Volunteer;
  to_volunteer?: Volunteer;
}

// ============================================
// Coverage Scenarios (Phase 6: Emergency Mode)
// ============================================

// Emergency coverage preset (e.g., "Sam & Alex out of town")
export interface CoverageScenario {
  id: string;
  name: string;                   // e.g., "Sam & Alex out of town"
  description?: string;           // e.g., "Primary coverage: Taylor, Jordan, Casey, Riley"
  unavailable_volunteers: string[]; // Array of volunteer IDs
  backup_decision_maker?: string; // Volunteer ID for backup coordinator
  active: boolean;
  created_at: string;
}

// Ops Hub state
export interface OpsState {
  // Identity
  currentVolunteer: Volunteer | null;

  // Data
  volunteers: Volunteer[];
  articles: KBArticle[];
  shiftAssignments: ShiftAssignment[];
  actionItems: ActionItem[];
  shiftChangeLog: ShiftChangeLogEntry[];

  // NEW: Rich shift details and coordination data
  shiftDetails: ShiftDetails[];
  handoffs: Handoff[];
  coverageScenarios: CoverageScenario[];
  activeCoverageScenario: CoverageScenario | null;

  // UI State
  selectedWeek: string; // ISO date of Monday
  sidebarOpen: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setCurrentVolunteer: (slug: string) => void;
  clearCurrentVolunteer: () => void;
  fetchVolunteers: () => Promise<void>;
  fetchArticles: (category?: KBCategory) => Promise<void>;
  fetchArticleBySlug: (slug: string) => Promise<KBArticle | null>;
  fetchShifts: (weekDate?: string) => Promise<void>;
  fetchActionItems: (weekDate?: string) => Promise<void>;
  toggleShiftConfirmation: (shiftId: string) => Promise<void>;
  updateShiftAssignment: (shiftId: string, updates: Partial<ShiftAssignment>) => Promise<void>;
  requestShiftSwap: (shiftId: string, targetVolunteerId: string) => Promise<void>;
  createShiftAssignment: (shift: Omit<ShiftAssignment, 'id' | 'created_at' | 'volunteer'>) => Promise<void>;
  deleteShiftAssignment: (shiftId: string) => Promise<void>;
  copyShiftsFromWeek: (sourceWeek: string, targetWeek: string, clearExisting?: boolean) => Promise<{ copied: number; message: string }>;
  getShiftsForWeek: (weekDate: string) => Promise<ShiftAssignment[]>;
  createActionItem: (item: Omit<ActionItem, 'id' | 'created_at' | 'assignee'>) => Promise<void>;
  updateActionItem: (itemId: string, updates: Partial<ActionItem>) => Promise<void>;
  deleteActionItem: (itemId: string) => Promise<void>;
  fetchShiftChangeLog: (weekDate?: string) => Promise<void>;
  setSelectedWeek: (weekDate: string) => void;
  toggleSidebar: () => void;

  // NEW: Rich shift details actions
  fetchShiftDetails: () => Promise<void>;
  getShiftDetailsForType: (shiftType: ShiftType) => ShiftDetails | undefined;
  updateShiftDetails: (shiftType: ShiftType, updates: Partial<ShiftDetails>) => Promise<void>;

  // NEW: Handoff tracking actions
  fetchHandoffs: (weekDate?: string) => Promise<void>;
  createHandoff: (handoff: Omit<Handoff, 'id' | 'created_at' | 'from_volunteer' | 'to_volunteer'>) => Promise<void>;
  updateHandoffStatus: (handoffId: string, status: HandoffStatus, notes?: string) => Promise<void>;
  deleteHandoff: (handoffId: string) => Promise<void>;
  getHandoffsForVolunteer: (volunteerId: string) => Handoff[];
  getHandoffsForShift: (shiftType: ShiftType, weekDate: string) => Handoff[];

  // NEW: Coverage scenario actions
  fetchCoverageScenarios: () => Promise<void>;
  createCoverageScenario: (scenario: Omit<CoverageScenario, 'id' | 'created_at'>) => Promise<void>;
  activateCoverageScenario: (scenarioId: string | null) => Promise<void>;
  deleteCoverageScenario: (scenarioId: string) => Promise<void>;

  // Real-time subscriptions
  subscribeToShifts: () => void;
  subscribeToActionItems: () => void;
  subscribeToHandoffs: () => void;
  unsubscribeAll: () => void;
}

// Utility: Get Monday of a given date's week
export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// Utility: Format week date for display
export function formatWeekDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// Shift type display names
export const SHIFT_TYPE_NAMES: Record<string, string> = {
  // Current shift types
  produce_market: 'Produce Market',
  truck_loading: 'Truck Loading',
  grocery_distribution: 'Grocery Store + Distribution',
  saturday_distribution: 'Saturday Distribution',
  saturday_evening_run: 'Evening Run',
  sunday_distribution: 'Sunday Distribution',
  // Legacy shift types
  produce_market_thu: 'Produce Market',
  grocery_fri: 'Grocery Store (Fri)',
  distribution_fri: 'Distribution (Fri)',
  timeless_fri: 'Timeless Bakery',
  grocery_sat: 'Grocery Store (Sat)',
  distribution_sat: 'Distribution (Sat)',
  evening_run_sat: 'Evening Run',
  sunday_meal_sun: 'Sunday Meal Program',
  distribution_sun: 'Distribution (Sun)',
};

// Time slot display names
export const TIME_SLOT_NAMES: Record<TimeSlot, string> = {
  thursday_evening: 'Thu Evening',
  friday_am: 'Fri AM',
  friday_noon: 'Fri Noon',
  friday_pm: 'Fri PM',
  saturday_am: 'Sat AM',
  saturday_noon: 'Sat Noon',
  saturday_pm: 'Sat PM',
  saturday_evening: 'Sat Evening',
  sunday_afternoon: 'Sun Afternoon',
};

// Category display names and icons
export const KB_CATEGORY_INFO: Record<KBCategory, { name: string; icon: string }> = {
  procedures: { name: 'Procedures', icon: '📋' },
  locations: { name: 'Locations', icon: '📍' },
  routes: { name: 'Routes', icon: '🚛' },
  contacts: { name: 'Contacts', icon: '👥' },
  general: { name: 'General', icon: '📖' },
};

// Handoff item type display names and icons
export const HANDOFF_TYPE_INFO: Record<HandoffItemType, { name: string; icon: string }> = {
  truck_key: { name: 'Truck Key', icon: '🔑' },
  door_code: { name: 'Door Code', icon: '🔐' },
  warehouse_key: { name: 'Warehouse Key', icon: '🗝️' },
  equipment: { name: 'Equipment', icon: '📦' },
  other: { name: 'Other', icon: '📋' },
};

// Handoff status display names and colors
export const HANDOFF_STATUS_INFO: Record<HandoffStatus, { name: string; color: string; icon: string }> = {
  pending: { name: 'Pending', color: 'amber', icon: '⏳' },
  confirmed: { name: 'Confirmed', color: 'blue', icon: '✓' },
  completed: { name: 'Completed', color: 'green', icon: '✅' },
};

// Time slot colors for visual consistency
export const TIME_SLOT_COLORS: Record<TimeSlot, string> = {
  thursday_evening: 'slate',
  friday_am: 'green',
  friday_noon: 'green',
  friday_pm: 'green',
  saturday_am: 'blue',
  saturday_noon: 'blue',
  saturday_pm: 'cyan',
  saturday_evening: 'cyan',
  sunday_afternoon: 'orange',
};

// Map time slot prefixes to day of week (0 = Sunday, 1 = Monday, etc.)
const TIME_SLOT_DAY_MAP: Record<string, number> = {
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 0,
};

/**
 * Check if a time slot is happening today
 * Takes into account both the day of week and the selected week
 */
export function isShiftToday(timeSlot: TimeSlot | undefined, weekDate: string): boolean {
  if (!timeSlot) return false;

  const today = new Date();
  const todayDayOfWeek = today.getDay();

  // Extract day from time slot (e.g., "saturday_noon" -> "saturday")
  const slotDay = timeSlot.split('_')[0];
  const slotDayOfWeek = TIME_SLOT_DAY_MAP[slotDay];

  if (slotDayOfWeek === undefined) return false;
  if (slotDayOfWeek !== todayDayOfWeek) return false;

  // Also check if we're viewing the current week
  const selectedMonday = new Date(weekDate);
  const currentMonday = getMonday(today);

  selectedMonday.setHours(0, 0, 0, 0);
  currentMonday.setHours(0, 0, 0, 0);

  return selectedMonday.getTime() === currentMonday.getTime();
}

/**
 * Get the actual date for a time slot within a given week
 */
export function getShiftDate(timeSlot: TimeSlot | undefined, weekDate: string): Date | null {
  if (!timeSlot) return null;

  const slotDay = timeSlot.split('_')[0];
  const slotDayOfWeek = TIME_SLOT_DAY_MAP[slotDay];

  if (slotDayOfWeek === undefined) return null;

  const monday = new Date(weekDate);
  // Calculate days from Monday (day 1) to target day
  const daysFromMonday = slotDayOfWeek === 0 ? 6 : slotDayOfWeek - 1;
  const shiftDate = new Date(monday);
  shiftDate.setDate(monday.getDate() + daysFromMonday);

  return shiftDate;
}
