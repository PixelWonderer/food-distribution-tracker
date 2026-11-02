import { VolunteerRole, TabId } from '@/types';

export interface RoleConfig {
  name: string;
  shortName: string;
  emoji: string;
  description: string;
  tabs: TabId[];
  groups: string[] | 'all' | 'userSelected';
  pickupGroups?: string[];  // Optional: different groups for Pickup view (used by Food Bank role)
}

// Role order: Food Bank first, then Pickup, then Co-op Delivery, then Full
export const ROLE_CONFIG: Record<VolunteerRole, RoleConfig> = {
  foodBank: {
    name: 'Food Bank',
    shortName: 'Food Bank',
    emoji: '🌐',
    description: 'Confirmation, storage, and Hub distribution',
    tabs: ['orderConfirmation', 'storage', 'pickup'],
    groups: ['partner_1', 'partner_2', 'partner_5', 'partner_6', 'partner_7'],
    pickupGroups: ['partner_2', 'partner_1', 'partner_7'],  // Limited pickup view
  },
  pickupOnly: {
    name: 'Pickup Only',
    shortName: 'Pickup',
    emoji: '🛒',
    description: 'Picking up items for my group at Hub',
    tabs: ['pickup'],
    groups: 'userSelected',
  },
  coopDelivery: {
    name: 'Co-op Delivery',
    shortName: 'Delivery',
    emoji: '🥕',
    description: 'Delivery to Co-op A, Co-op B, Co-op C, and Partner Groups 4, 8, 9',
    tabs: ['pickup'],  // No Storage tab
    groups: ['coop_a', 'coop_b', 'partner_4', 'coop_c', 'partner_8', 'partner_9'],
  },
  fullAccess: {
    name: 'Full Access',
    shortName: 'Full',
    emoji: '🔓',
    description: 'See everything',
    tabs: ['orderConfirmation', 'storage', 'pickup', 'inventory'],
    groups: 'all',
  },
};

// Available timing slots for filtering
export const TIMING_SLOTS = [
  { value: 'friday am', label: 'Friday AM' },
  { value: 'friday pm', label: 'Friday PM' },
  { value: 'saturday am', label: 'Saturday AM' },
  { value: 'saturday noon', label: 'Saturday Noon' },
  { value: 'saturday pm', label: 'Saturday PM' },
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday am', label: 'Monday AM' },
] as const;

// Helper to get visible tabs for a role
export function getVisibleTabs(role: VolunteerRole | undefined): TabId[] {
  if (!role) return ROLE_CONFIG.fullAccess.tabs;
  return ROLE_CONFIG[role].tabs;
}

// Helper to get the first/default tab for a role
export function getDefaultTabForRole(role: VolunteerRole | undefined): TabId {
  const tabs = getVisibleTabs(role);
  return tabs[0];
}

// Helper to check if a tab is visible for a role
export function isTabVisibleForRole(tab: TabId, role: VolunteerRole | undefined): boolean {
  const visibleTabs = getVisibleTabs(role);
  return visibleTabs.includes(tab);
}

// Helper to get allowed groups for a role
// forPickupView: when true, uses pickupGroups if available (for Food Bank role's limited pickup view)
export function getAllowedGroupsForRole(
  role: VolunteerRole | undefined,
  selectedGroups: string[] | undefined,
  selectedTiming: string[] | undefined,  // Now an array for multi-select
  pickupFilterMode: 'groups' | 'timing' | undefined,
  allGroupKeys: string[],
  forPickupView: boolean = false
): string[] | 'all' {
  if (!role) return 'all';

  const config = ROLE_CONFIG[role];

  if (config.groups === 'all') {
    return 'all';
  }

  if (config.groups === 'userSelected') {
    // For pickupOnly role, respect their filter mode
    if (pickupFilterMode === 'timing' && selectedTiming && selectedTiming.length > 0) {
      // Return 'all' to signal we should filter by timing downstream
      return 'all'; // Will be filtered by timing in the view
    }
    return selectedGroups && selectedGroups.length > 0 ? selectedGroups : allGroupKeys;
  }

  // For roles with fixed groups, use pickupGroups if available and viewing pickup
  if (forPickupView && config.pickupGroups) {
    return config.pickupGroups;
  }

  return config.groups;
}
