import { describe, it, expect } from 'vitest';
import {
  groupConfirmationItems,
  determineItemStatus,
  summarizeGroups,
  buildConfirmationStatus,
} from '@/app/utils/confirmation';
import type { OrderConfirmationItem } from '@/types';

/** Helper to create a minimal OrderConfirmationItem with overrides */
const makeItem = (overrides: Partial<OrderConfirmationItem> = {}): OrderConfirmationItem => ({
  orderId: 'test-1',
  itemName: 'Test Item',
  expectedQuantity: 10,
  receivedQuantity: null,
  isConfirmed: false,
  ranOut: false,
  unit: 'cases',
  emoji: '📦',
  storageType: null,
  confirmedBy: null,
  confirmedAt: null,
  sheetRow: null,
  ...overrides,
});

describe('confirmation utils', () => {
  // -------------------------------------------------------------------
  // determineItemStatus
  // -------------------------------------------------------------------
  describe('determineItemStatus', () => {
    it('returns "pending" for unconfirmed item with no received quantity', () => {
      expect(determineItemStatus(makeItem())).toBe('pending');
    });

    it('returns "expected" when isConfirmed is true', () => {
      expect(determineItemStatus(makeItem({ isConfirmed: true }))).toBe('expected');
    });

    it('returns "ran-out" when ranOut flag is set AND volunteer has confirmed', () => {
      expect(determineItemStatus(makeItem({ ranOut: true, isConfirmed: true }))).toBe('ran-out');
    });

    it('returns "pending" when ranOut is set provisionally (no volunteer confirmation)', () => {
      // Provisional ran_out = Claude/Food Bank-driven heads-up before pickup.
      // Treated as 'pending' so volunteers can override at pickup via the
      // normal pending → ran-low → ran-out cycle.
      expect(determineItemStatus(makeItem({ ranOut: true, isConfirmed: false }))).toBe('pending');
    });

    it('returns "ran-out" when receivedQuantity is 0 (the < expected branch)', () => {
      // receivedQuantity === 0 with expectedQuantity > 0 hits the
      // "received < expected" branch which returns 'ran-out' regardless of
      // isConfirmed. In practice this state only arises when mark_item_ran_out
      // ran (which sets is_confirmed=true), so the distinction is moot.
      expect(determineItemStatus(makeItem({ receivedQuantity: 0 }))).toBe('ran-out');
    });

    it('returns "ran-out" when receivedQuantity is 0 and isConfirmed is true', () => {
      // receivedQuantity === 0 + confirmed = volunteer signed off on ran-out
      expect(
        determineItemStatus(makeItem({ receivedQuantity: 0, isConfirmed: true }))
      ).toBe('ran-out');
    });

    it('returns "ran-low" when receivedQuantity < expectedQuantity and > 0', () => {
      expect(
        determineItemStatus(makeItem({ receivedQuantity: 5, expectedQuantity: 10 }))
      ).toBe('ran-low');
    });

    it('returns "ran-out" when receivedQuantity < expected and equals 0', () => {
      expect(
        determineItemStatus(makeItem({ receivedQuantity: 0, expectedQuantity: 10 }))
      ).toBe('ran-out');
    });

    it('returns "expected" when receivedQuantity equals expectedQuantity and isConfirmed', () => {
      expect(
        determineItemStatus(
          makeItem({ receivedQuantity: 10, expectedQuantity: 10, isConfirmed: true })
        )
      ).toBe('expected');
    });

    it('returns "pending" when receivedQuantity >= expectedQuantity but not confirmed', () => {
      // receivedQuantity is not less than expected, and isConfirmed is false
      expect(
        determineItemStatus(makeItem({ receivedQuantity: 10, expectedQuantity: 10 }))
      ).toBe('pending');
    });

    it('ranOut flag takes priority over receivedQuantity', () => {
      expect(
        determineItemStatus(makeItem({ ranOut: true, receivedQuantity: 10, isConfirmed: true }))
      ).toBe('ran-out');
    });
  });

  // -------------------------------------------------------------------
  // groupConfirmationItems
  // -------------------------------------------------------------------
  describe('groupConfirmationItems', () => {
    it('returns empty array for empty input', () => {
      expect(groupConfirmationItems([])).toEqual([]);
    });

    it('groups fridge items correctly', () => {
      const items = [
        makeItem({ orderId: '1', storageType: 'Fridge' }),
        makeItem({ orderId: '2', storageType: 'freezer' }),
        makeItem({ orderId: '3', storageType: 'Cold storage' }),
      ];
      const groups = groupConfirmationItems(items);
      expect(groups).toHaveLength(1);
      expect(groups[0].key).toBe('fridge');
      expect(groups[0].items).toHaveLength(3);
    });

    it('groups pantry/table items correctly', () => {
      const items = [
        makeItem({ orderId: '1', storageType: 'Pantry' }),
        makeItem({ orderId: '2', storageType: 'table' }),
        makeItem({ orderId: '3', storageType: 'Dry goods' }),
      ];
      const groups = groupConfirmationItems(items);
      expect(groups).toHaveLength(1);
      expect(groups[0].key).toBe('pantry');
      expect(groups[0].items).toHaveLength(3);
    });

    it('defaults null storageType to pantry', () => {
      const items = [makeItem({ storageType: null })];
      const groups = groupConfirmationItems(items);
      expect(groups).toHaveLength(1);
      expect(groups[0].key).toBe('pantry');
    });

    it('puts unrecognised storageType in other', () => {
      const items = [makeItem({ storageType: 'garage' })];
      const groups = groupConfirmationItems(items);
      expect(groups).toHaveLength(1);
      expect(groups[0].key).toBe('other');
    });

    it('creates multiple groups for mixed storage types', () => {
      const items = [
        makeItem({ orderId: '1', storageType: 'Fridge' }),
        makeItem({ orderId: '2', storageType: 'table' }),
        makeItem({ orderId: '3', storageType: 'garage' }),
      ];
      const groups = groupConfirmationItems(items);
      expect(groups).toHaveLength(3);
      const keys = groups.map((g) => g.key);
      expect(keys).toContain('fridge');
      expect(keys).toContain('pantry');
      expect(keys).toContain('other');
    });

    it('omits empty groups', () => {
      const items = [makeItem({ storageType: 'Fridge' })];
      const groups = groupConfirmationItems(items);
      expect(groups).toHaveLength(1);
      expect(groups[0].key).toBe('fridge');
    });

    it('groups have correct labels and icons', () => {
      const items = [
        makeItem({ orderId: '1', storageType: 'Fridge' }),
        makeItem({ orderId: '2', storageType: 'table' }),
      ];
      const groups = groupConfirmationItems(items);
      const fridge = groups.find((g) => g.key === 'fridge')!;
      const pantry = groups.find((g) => g.key === 'pantry')!;
      expect(fridge.label).toBe('Fridge items');
      expect(fridge.icon).toBe('🧊');
      expect(pantry.label).toBe('Table items');
      expect(pantry.icon).toBe('🪑');
    });
  });

  // -------------------------------------------------------------------
  // summarizeGroups
  // -------------------------------------------------------------------
  describe('summarizeGroups', () => {
    it('returns zeros for empty groups array', () => {
      expect(summarizeGroups([])).toEqual({
        confirmed: 0,
        ranLow: 0,
        ranOut: 0,
        total: 0,
      });
    });

    it('counts confirmed (expected) items', () => {
      const groups = groupConfirmationItems([
        makeItem({ orderId: '1', isConfirmed: true }),
        makeItem({ orderId: '2', isConfirmed: true }),
        makeItem({ orderId: '3' }),
      ]);
      const summary = summarizeGroups(groups);
      expect(summary.confirmed).toBe(2);
      expect(summary.total).toBe(3);
    });

    it('counts committed ran-out items (isConfirmed=true)', () => {
      const groups = groupConfirmationItems([
        makeItem({ orderId: '1', ranOut: true, isConfirmed: true }),
        makeItem({ orderId: '2', receivedQuantity: 0, isConfirmed: true }),
      ]);
      const summary = summarizeGroups(groups);
      expect(summary.ranOut).toBe(2);
      expect(summary.confirmed).toBe(0);
    });

    it('counts provisional ran-out (isConfirmed=false) as pending, not ran-out', () => {
      const groups = groupConfirmationItems([
        makeItem({ orderId: '1', ranOut: true }), // isConfirmed=false default
      ]);
      const summary = summarizeGroups(groups);
      expect(summary.ranOut).toBe(0);
      expect(summary.confirmed).toBe(0);
      expect(summary.total).toBe(1);
    });

    it('counts ran-low items', () => {
      const groups = groupConfirmationItems([
        makeItem({ orderId: '1', receivedQuantity: 5, expectedQuantity: 10 }),
      ]);
      const summary = summarizeGroups(groups);
      expect(summary.ranLow).toBe(1);
    });

    it('pending items are not counted in any category', () => {
      const groups = groupConfirmationItems([makeItem()]);
      const summary = summarizeGroups(groups);
      expect(summary.total).toBe(1);
      expect(summary.confirmed).toBe(0);
      expect(summary.ranLow).toBe(0);
      expect(summary.ranOut).toBe(0);
    });

    it('handles mixed statuses across multiple groups', () => {
      const groups = groupConfirmationItems([
        makeItem({ orderId: '1', storageType: 'Fridge', isConfirmed: true }),
        makeItem({ orderId: '2', storageType: 'Fridge', ranOut: true, isConfirmed: true }),
        makeItem({ orderId: '3', storageType: 'table', receivedQuantity: 3, expectedQuantity: 10 }),
        makeItem({ orderId: '4', storageType: 'table' }), // pending
      ]);
      const summary = summarizeGroups(groups);
      expect(summary.total).toBe(4);
      expect(summary.confirmed).toBe(1);
      expect(summary.ranOut).toBe(1);
      expect(summary.ranLow).toBe(1);
    });
  });

  // -------------------------------------------------------------------
  // buildConfirmationStatus
  // -------------------------------------------------------------------
  describe('buildConfirmationStatus', () => {
    it('returns zero totals for empty array', () => {
      const status = buildConfirmationStatus([]);
      expect(status).toEqual({ totalItems: 0, confirmedItems: 0, allConfirmed: false });
    });

    it('allConfirmed is true when every item is expected', () => {
      const items = [
        makeItem({ orderId: '1', isConfirmed: true }),
        makeItem({ orderId: '2', isConfirmed: true }),
      ];
      const status = buildConfirmationStatus(items);
      expect(status.totalItems).toBe(2);
      expect(status.confirmedItems).toBe(2);
      expect(status.allConfirmed).toBe(true);
    });

    it('allConfirmed is false when some items are pending', () => {
      const items = [
        makeItem({ orderId: '1', isConfirmed: true }),
        makeItem({ orderId: '2' }),
      ];
      const status = buildConfirmationStatus(items);
      expect(status.totalItems).toBe(2);
      expect(status.confirmedItems).toBe(1);
      expect(status.allConfirmed).toBe(false);
    });

    it('does not count ran-out or ran-low as confirmed', () => {
      const items = [
        makeItem({ orderId: '1', ranOut: true, isConfirmed: true }),
        makeItem({ orderId: '2', receivedQuantity: 3, expectedQuantity: 10 }),
      ];
      const status = buildConfirmationStatus(items);
      expect(status.confirmedItems).toBe(0);
      expect(status.allConfirmed).toBe(false);
    });
  });
});
