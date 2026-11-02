export interface Group {
  name: string;
  timing: string;
  direct: boolean;
}

export interface Groups {
  [key: string]: Group;
}

export interface ColumnMap {
  [key: string]: number;
}

export interface EmojiMap {
  [key: string]: string;
}

export interface SheetRow extends Array<any> {
  [index: number]: any;
}

export interface SheetData extends Array<SheetRow> {}

export interface CustomItem {
  id: string
  destinationCode: string
  destinationName: string
  itemName: string
  quantity: number
  unit?: string | null
  isPacked: boolean
  addedBy?: string | null
  inventoryItemId?: string | null
}

export interface Supplies {
  mealBoxes: Record<string, boolean>
  forks: Record<string, boolean>
  [key: string]: Record<string, boolean>
}

export interface StorageTypes {
  [itemName: string]: 'Pantry' | 'Fridge' | string;
}

export interface DaySplit {
  allocationId: string;
  day: string; // 'Friday' | 'Saturday' | 'Sunday'
  quantity: number;
}

export interface OrderConfirmationItem {
  orderId: string;
  itemName: string;
  expectedQuantity: number;
  receivedQuantity: number | null;
  isConfirmed: boolean;
  ranOut: boolean;
  unit: string | null;
  emoji: string;
  storageType: string | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  sheetRow: number | null;
}

export interface OrderConfirmationStatus {
  totalItems: number;
  confirmedItems: number;
  allConfirmed: boolean;
}

export interface OrderConfirmationReset {
  weekDate: string;
  resetBy: string | null;
  resetAt: string;
}

// ===================
// INVENTORY TYPES (replacing Surplus)
// ===================

// Pantry subcategories for inventory organization
export type PantrySubcategory =
  | 'Beans & Legumes'
  | 'Grains & Pasta'
  | 'Canned Goods'
  | 'Condiments & Sauces'
  | 'Snacks & Other';

// View modes for the inventory tab
export type InventoryViewMode = 'browse' | 'count' | 'reorder';

export interface InventoryItem {
  id: string;
  orderId: string | null;        // Link to Food Bank order, null for custom items
  customName: string | null;     // For non-Food Bank items

  // Display info (computed from order or customName)
  itemName: string;
  emoji: string;
  unit: string;
  category: string | null;
  subcategory: PantrySubcategory | null;  // Pantry subcategory for filtering
  storageLocation: string | null;

  // Quantity tracking
  currentQuantity: number;
  lowStockThreshold: number;
  isLowStock: boolean;           // Computed: currentQuantity <= lowStockThreshold

  // Audit
  lastUpdatedAt: string;
  lastUpdatedBy: string | null;
  isActive: boolean;

  // Storage view tracking
  isPacked: boolean;
}

export interface InventoryHistoryEntry {
  id: string;
  inventoryItemId: string;
  previousQuantity: number | null;
  newQuantity: number;
  changeType: 'manual_count' | 'order_import' | 'adjustment' | 'correction' | 'initial';
  changeReason: string | null;
  changedBy: string | null;
  changedAt: string;
  sourceOrderId: string | null;
  weekDate: string | null;
  // Attribution for tracking who took items
  destinationId: string | null;
  destinationName: string | null;
}

export interface OrderSuggestion {
  id: string;
  inventoryItemId: string;
  inventoryItem: InventoryItem;
  suggestedQuantity: number | null;
  reason: 'low_stock' | 'manual_add' | 'popular_item';
  addedAt: string;
  addedBy: string | null;
  isFulfilled: boolean;
  fulfilledAt: string | null;
  fulfilledBy: string | null;
}

// Role-based focus mode types
// Order: Food Bank first, then Pickup, then Co-op Delivery, then Full
export type VolunteerRole = 'foodBank' | 'pickupOnly' | 'coopDelivery' | 'fullAccess';

export type PickupFilterMode = 'groups' | 'timing';

export type TabId = 'orderConfirmation' | 'storage' | 'pickup' | 'inventory';

export interface UserPreferences {
  volunteerName: string;
  /** @deprecated Use activeTab instead - this will be removed in a future version */
  defaultTab?: TabId;
  /** The last active tab - persisted to resume where user left off */
  activeTab?: TabId;
  autoScroll: boolean;
  compactMode: boolean;
  // Role-based focus mode
  role?: VolunteerRole;
  pickupFilterMode?: PickupFilterMode;  // For pickupOnly: filter by group or timing
  selectedGroups?: string[];             // For pickupOnly with groups mode
  selectedTiming?: string[];             // For pickupOnly with timing mode (multi-select)
  hasCompletedRoleSetup?: boolean;
  showShiftTasks?: boolean;
  hasSeenShiftTasksIntro?: boolean;
}

export interface DestinationInfo {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  timing: string | null;
  defaultTiming: string | null;
  isDirect: boolean;
  displayOrder: number;
  // Custom destination fields
  isCustom?: boolean;
  isActive?: boolean;
  createdBy?: string | null;
}

export interface Redirection {
  id: string;
  allocationId: string;
  sourceDestinationId: string;
  targetDestinationId: string;
  sourceDestinationName?: string;
  targetDestinationName?: string;
  quantity: number;
  itemName?: string;
  redirectedBy: string | null;
  redirectedAt: string | null;
  weekDate: string;
}

// Enriched redirection data for display (with resolved names)
export interface RedirectedAwayItem {
  redirectionId: string;
  itemName: string;
  emoji: string;
  quantity: number;
  targetDestinationId: string;
  targetDestinationName: string;
  redirectedAt: string | null;
  redirectedBy: string | null;
}

// Type for redirected-away items grouped by source destination
export type RedirectedAwayBySource = Record<string, RedirectedAwayItem[]>;

// Banking feature - save items for next week
export interface BankedItem {
  id: string;
  destinationId: string;
  destinationName: string;
  itemName: string;
  quantity: number;
  bankedBy: string | null;
  bankedAt: string;
  weekDate: string;
}

// Request to open the BankItemSheet modal
export interface BankItemRequest {
  allocationId: string;
  destinationId: string;
  destinationName: string;
  itemName: string;
  emoji: string;
  availableQuantity: number;
}

export interface AppState {
  preferences: UserPreferences;
  sheetData: SheetData | null;
  trackingData: SheetData | null;
  storageData: SheetData | null;
  storageTypes: StorageTypes;
  syncMetadata: any;
  customItems: CustomItem[];
  supplies: Supplies;
  destinations: DestinationInfo[];
  orderConfirmationItems: OrderConfirmationItem[];
  orderConfirmationStatus: OrderConfirmationStatus | null;
  orderConfirmationResets: OrderConfirmationReset[];
  currentWeekDate: string | null;
  inventoryItems: InventoryItem[];
  inventoryViewMode: InventoryViewMode;
  itemRowLookup: Record<string, number>;
  allocationLookup: Record<
    string,
    {
      allocationId: string;
      destinationCode: string;
      row: number;
      col: number;
      isStored: boolean;
      isDistributed: boolean;
    }
  >;
  customDestinationAllocations: Array<{
    allocationId: string;
    destinationId: string;
    destinationCode: string;
    itemName: string;
    quantity: number;
    isStored: boolean;
    isDistributed: boolean;
    emoji: string;
    storageType: string | null;
  }>;
  daySplits: DaySplit[];
  redirectedAwayBySource: RedirectedAwayBySource;
  bankedItems: BankedItem[];
  destinationCodes: Record<string, string>;
  pendingChanges: Map<string, any>;
  failedChanges: Map<string, any>;
  currentTab: TabId;
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
  syncError: string | null;
  hasInitializedTab: boolean;

  // Real-time sync status
  realtimeStatus: 'connected' | 'disconnected' | 'error' | 'polling';
  syncMethod: 'realtime' | 'polling' | 'manual' | 'unknown';

  // Tutorial demo mode
  isDemoMode: boolean;
  isTutorialActive: boolean;

  // Shift tasks (recurring time-specific reminders)
  shiftTasks: ShiftTaskWithStatus[];
}

export interface SyncChange {
  type: 'toggle' | 'supply' | 'custom' | 'group';
  row?: number;
  col?: number;
  value?: any;
  destination?: string;
  itemId?: string;
}

export interface ItemData {
  row: number;
  name: string;
  quantity: number;
  emoji: string;
  isCustom: boolean;
  customId?: string;
  storageType?: string;
  ranOut: boolean;
  isPacked?: boolean;   // For custom items and redirected items (uses isDistributed)
  isRedirected?: boolean; // For items redirected to custom destinations
  allocationId?: string;  // For redirected items - needed for toggle functionality
  groupKey?: string;    // For aggregated storage mode
  colIndex?: number;    // For aggregated storage mode
  destinations?: Array<{groupKey: string, row: number, colIndex: number, quantity: number}>; // For aggregated items
  // For inventory items in StorageView
  inventoryId?: string;     // Link to inventory item ID
  isInventoryItem?: boolean; // Flag for special handling in StorageView
  // For custom items created from inventory Takes
  inventoryItemId?: string;  // Source inventory item — enables "Return to Inventory"
}

export interface GroupData {
  key: string;
  name: string;
  timing: string;
  direct: boolean;
  items: ItemData[];
  completedCount: number;
  totalCount: number;
}

// ============================================
// SHIFT TASKS (recurring time-specific tasks)
// ============================================

export interface ShiftTask {
  id: string;
  title: string;
  description: string | null;
  emoji: string;
  timing: string;
  displayOrder: number;
  isActive: boolean;
}

export interface ShiftTaskWithStatus extends ShiftTask {
  isCompleted: boolean;
  completedBy: string | null;
  completedAt: string | null;
}
