/**
 * Demo Data Service
 *
 * Provides sample data for tutorial demo mode so users can
 * practice interacting with the app without affecting real data.
 */

import type { SupabaseDataResponse } from './supabaseDataService';
import type { SheetData, StorageTypes, CustomItem, Supplies } from '@/types';
import { COLUMN_MAP } from '@/utils/constants';

// Demo food items - ordered for tutorial flow
// First 3 items (Milk, Bread, Rice) are targeted by tutorial Confirmation phase
// Reduced to 5 items to fit on screen without excessive scrolling during tutorial
const DEMO_ITEMS = [
  { name: 'Milk', emoji: '🥛', quantity: 8, storageType: 'Fridge' as const, unit: 'gallons' },
  { name: 'Bread', emoji: '🍞', quantity: 12, storageType: 'Fridge' as const, unit: 'loaves' },
  { name: 'Rice', emoji: '🍚', quantity: 10, storageType: 'Fridge' as const, unit: 'bags' },
  { name: 'Apples', emoji: '🍎', quantity: 20, storageType: 'Pantry' as const, unit: 'lbs' },
  { name: 'Pasta', emoji: '🍝', quantity: 18, storageType: 'Pantry' as const, unit: 'boxes' },
];

// Demo destinations with allocation ratios
const DEMO_ALLOCATIONS: Record<string, number> = {
  partner_1: 0.13,
  partner_2: 0.10,
  partner_3: 0.08,
  coop_a: 0.11,
  coop_b: 0.08,
  partner_6: 0.12,
  partner_5: 0.10,
  partner_4: 0.10,
  coop_c: 0.08,
  partner_7: 0.10,
};

/**
 * Creates a complete demo payload matching SupabaseDataResponse structure
 */
export function createDemoPayload(): SupabaseDataResponse {
  const headerRow = [
    'Item', 'UOM', 'Total Qty Limit', 'Total Qty Requested',
    'Partner Group 7', 'Partner Group 1', 'Partner Group 2', 'Partner Group 3', 'Co-op B', 'Co-op A',
    'Partner Group 4', 'Partner Group 5', 'Partner Group 6', 'Co-op C',
    'Max out?', 'Surplus', 'Ran out?', 'Storage Type'
  ];

  const sheetData: SheetData = [];
  const trackingData: SheetData = [];
  const storageData: SheetData = [];
  const storageTypes: StorageTypes = {};
  const itemRowLookup: Record<string, number> = {};
  const allocationLookup: Record<string, any> = {};

  // Add header rows
  sheetData[0] = [...headerRow];
  sheetData[1] = [...headerRow];
  trackingData[0] = [...headerRow];
  trackingData[1] = [...headerRow];
  storageData[0] = [...headerRow];
  storageData[1] = [...headerRow];

  // Create data rows for each demo item
  DEMO_ITEMS.forEach((item, index) => {
    const rowIndex = index + 2; // Start after header rows
    const dataRow: any[] = new Array(headerRow.length).fill('');
    const trackingRow: any[] = new Array(headerRow.length).fill(false);
    const storageRow: any[] = new Array(headerRow.length).fill(false);

    dataRow[0] = item.name;
    dataRow[1] = item.unit;
    trackingRow[0] = item.name;
    storageRow[0] = item.name;

    let totalRequested = 0;

    // Distribute quantities to each destination
    Object.entries(DEMO_ALLOCATIONS).forEach(([destKey, ratio]) => {
      const colIndex = COLUMN_MAP[destKey as keyof typeof COLUMN_MAP];
      if (colIndex !== undefined) {
        const qty = Math.round(item.quantity * ratio);
        if (qty > 0) {
          dataRow[colIndex] = qty;
          totalRequested += qty;

          // For tutorial: ALL items start fresh (not stored, not distributed)
          // This allows the tutorial to demonstrate storage and pickup phases properly
          const isStored = false;
          const isDistributed = false;

          storageRow[colIndex] = isStored;
          trackingRow[colIndex] = isDistributed;

          // Create allocation lookup entry
          const key = `${rowIndex}:${colIndex}`;
          allocationLookup[key] = {
            allocationId: `demo-${item.name}-${destKey}`,
            destinationCode: destKey.toUpperCase().slice(0, 3),
            row: rowIndex,
            col: colIndex,
            isStored,
            isDistributed,
          };
        }
      }
    });

    dataRow[3] = totalRequested; // Total Qty Requested
    dataRow[14] = true; // Max out?
    dataRow[15] = Math.max(0, item.quantity - totalRequested); // Surplus
    dataRow[16] = false; // Ran out?
    dataRow[17] = item.storageType; // Storage Type

    sheetData[rowIndex] = dataRow;
    trackingData[rowIndex] = trackingRow;
    storageData[rowIndex] = storageRow;

    storageTypes[item.name] = item.storageType;
    itemRowLookup[item.name] = rowIndex;
  });

  // Create order confirmation items - ALL pending for tutorial to demonstrate
  const orderConfirmationItems = DEMO_ITEMS.map((item, index) => ({
    orderId: `demo-order-${index}`,
    itemName: item.name,
    expectedQuantity: item.quantity,
    // For tutorial: ALL items start as pending (not confirmed)
    receivedQuantity: null,
    isConfirmed: false,
    ranOut: false,
    unit: item.unit,
    emoji: item.emoji,
    storageType: item.storageType,
    confirmedBy: null,
    confirmedAt: null,
    sheetRow: index + 2,
  }));

  // Create demo supplies
  const supplies: Supplies = {
    mealBoxes: {
      coop_a: false,
      coop_b: true,
      coop_c: false,
    },
    forks: {
      coop_a: true,
      coop_b: false,
      coop_c: false,
    },
  };

  // Create demo custom items
  const customItems: CustomItem[] = [
    {
      id: 'demo-custom-1',
      destinationCode: 'P1',
      destinationName: 'Partner Group 1',
      itemName: 'Extra Bananas',
      quantity: 5,
      unit: 'bunches',
      isPacked: false,
      addedBy: 'Demo Volunteer',
    },
  ];

  // Use today's date in ISO format for database compatibility
  const demoWeekDate = new Date().toISOString().split('T')[0]; // e.g., '2025-12-05'

  // Create demo inventory items
  const inventoryItems = [
    {
      id: 'demo-inventory-1',
      orderId: 'demo-order-0',
      customName: null,
      itemName: 'Apples',
      emoji: '🍎',
      unit: 'lbs',
      category: 'Pantry',
      subcategory: 'Snacks & Other' as const,
      storageLocation: 'Pantry',
      currentQuantity: 5,
      lowStockThreshold: 2,
      isLowStock: false,
      lastUpdatedAt: new Date().toISOString(),
      lastUpdatedBy: 'Demo',
      isActive: true,
      isPacked: false,
    },
    {
      id: 'demo-inventory-2',
      orderId: null,
      customName: 'Rice',
      itemName: 'Rice',
      emoji: '🍚',
      unit: 'lbs',
      category: 'Pantry',
      subcategory: 'Grains & Pasta' as const,
      storageLocation: 'Pantry',
      currentQuantity: 1,
      lowStockThreshold: 3,
      isLowStock: true,
      lastUpdatedAt: new Date().toISOString(),
      lastUpdatedBy: 'Demo',
      isActive: true,
      isPacked: false,
    },
  ];

  // Destination codes mapping
  const destinationCodes: Record<string, string> = {
    partner_1: 'P1',
    partner_2: 'P2',
    coop_a: 'CO-A',
    coop_b: 'CO-B',
    partner_6: 'P6',
    partner_5: 'P5',
    partner_4: 'P4',
    coop_c: 'CO-C',
    partner_7: 'P7',
  };

  return {
    data: sheetData,
    tracking: trackingData,
    storage: storageData,
    storageTypes,
    customItems,
    supplies,
    orderConfirmationItems,
    orderConfirmationStatus: {
      totalItems: DEMO_ITEMS.length,
      confirmedItems: 0, // All items start unconfirmed for tutorial
      allConfirmed: false,
    },
    orderConfirmationResets: [],
    currentWeekDate: demoWeekDate,
    destinationCodes,
    itemRowLookup,
    allocationLookup,
    inventoryItems,
    destinations: [], // Demo mode doesn't use dynamic destinations
    customDestinationAllocations: [], // No custom destination allocations in demo
    daySplits: [], // No day splits in demo
    syncMetadata: {
      last_modified_at: new Date().toISOString(),
      modified_by: 'Demo Mode',
    },
  };
}

/**
 * Demo state manager for local mutations during demo mode
 */
class DemoStateManager {
  private state: SupabaseDataResponse | null = null;

  initialize(): SupabaseDataResponse {
    this.state = createDemoPayload();
    return this.state;
  }

  getState(): SupabaseDataResponse | null {
    return this.state;
  }

  reset(): void {
    this.state = null;
  }

  // Toggle storage status for an allocation
  toggleStorage(row: number, col: number): boolean {
    if (!this.state) return false;

    const storageRow = this.state.storage[row];
    if (Array.isArray(storageRow) && typeof storageRow[col] === 'boolean') {
      storageRow[col] = !storageRow[col];

      // Update allocation lookup
      const key = `${row}:${col}`;
      if (this.state.allocationLookup[key]) {
        this.state.allocationLookup[key].isStored = storageRow[col];
      }
      return true;
    }
    return false;
  }

  // Toggle distribution status for an allocation
  toggleDistribution(row: number, col: number): boolean {
    if (!this.state) return false;

    const trackingRow = this.state.tracking[row];
    if (Array.isArray(trackingRow) && typeof trackingRow[col] === 'boolean') {
      trackingRow[col] = !trackingRow[col];

      // Update allocation lookup
      const key = `${row}:${col}`;
      if (this.state.allocationLookup[key]) {
        this.state.allocationLookup[key].isDistributed = trackingRow[col];
      }
      return true;
    }
    return false;
  }

  // Confirm order item at expected quantity
  confirmItem(orderId: string): boolean {
    if (!this.state) return false;

    const item = this.state.orderConfirmationItems.find(i => i.orderId === orderId);
    if (item) {
      item.isConfirmed = true;
      item.receivedQuantity = item.expectedQuantity;
      item.confirmedBy = 'Demo User';
      item.confirmedAt = new Date().toISOString();

      // Update status
      if (this.state.orderConfirmationStatus) {
        this.state.orderConfirmationStatus.confirmedItems++;
        this.state.orderConfirmationStatus.allConfirmed =
          this.state.orderConfirmationStatus.confirmedItems >=
          this.state.orderConfirmationStatus.totalItems;
      }
      return true;
    }
    return false;
  }

  // Mark item as ran out
  markItemRanOut(orderId: string): boolean {
    if (!this.state) return false;

    const item = this.state.orderConfirmationItems.find(i => i.orderId === orderId);
    if (item) {
      item.isConfirmed = true;
      item.ranOut = true;
      item.receivedQuantity = 0;
      item.confirmedBy = 'Demo User';
      item.confirmedAt = new Date().toISOString();

      // Update status
      if (this.state.orderConfirmationStatus) {
        this.state.orderConfirmationStatus.confirmedItems++;
        this.state.orderConfirmationStatus.allConfirmed =
          this.state.orderConfirmationStatus.confirmedItems >=
          this.state.orderConfirmationStatus.totalItems;
      }
      return true;
    }
    return false;
  }

  // Update item with partial quantity
  updateItemQuantity(orderId: string, receivedQuantity: number): boolean {
    if (!this.state) return false;

    const item = this.state.orderConfirmationItems.find(i => i.orderId === orderId);
    if (item) {
      item.isConfirmed = true;
      item.receivedQuantity = receivedQuantity;
      item.confirmedBy = 'Demo User';
      item.confirmedAt = new Date().toISOString();

      // Update status
      if (this.state.orderConfirmationStatus) {
        this.state.orderConfirmationStatus.confirmedItems++;
        this.state.orderConfirmationStatus.allConfirmed =
          this.state.orderConfirmationStatus.confirmedItems >=
          this.state.orderConfirmationStatus.totalItems;
      }
      return true;
    }
    return false;
  }
}

// Singleton instance
export const demoStateManager = new DemoStateManager();
