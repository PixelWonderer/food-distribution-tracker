import type { OrderConfirmationItem, OrderConfirmationStatus } from '@/types';

export type ConfirmationStatus = 'pending' | 'expected' | 'ran-out' | 'ran-low';

export type ConfirmationGroup = {
  key: 'fridge' | 'pantry' | 'other';
  label: string;
  icon: string;
  items: OrderConfirmationItem[];
};

const STORAGE_TYPE_ALIASES: Record<ConfirmationGroup['key'], string[]> = {
  fridge: ['fridge', 'freezer', 'cold'],
  pantry: ['pantry', 'table', 'dry'],
  other: [],
};

const resolveGroupKey = (storageType: string | null | undefined): ConfirmationGroup['key'] => {
  if (!storageType) {
    return 'pantry';
  }

  const normalized = storageType.toLowerCase();
  if (STORAGE_TYPE_ALIASES.fridge.some((alias) => normalized.includes(alias))) {
    return 'fridge';
  }
  if (STORAGE_TYPE_ALIASES.pantry.some((alias) => normalized.includes(alias))) {
    return 'pantry';
  }
  return 'other';
};

export const groupConfirmationItems = (items: OrderConfirmationItem[]): ConfirmationGroup[] => {
  const groups: Record<ConfirmationGroup['key'], ConfirmationGroup> = {
    fridge: { key: 'fridge', label: 'Fridge items', icon: '🧊', items: [] },
    pantry: { key: 'pantry', label: 'Table items', icon: '🪑', items: [] },
    other: { key: 'other', label: 'Other items', icon: '📦', items: [] },
  };

  items.forEach((item) => {
    const key = resolveGroupKey(item.storageType);
    groups[key].items.push(item);
  });

  return (Object.values(groups) as ConfirmationGroup[]).filter((group) => group.items.length > 0);
};

export const determineItemStatus = (item: OrderConfirmationItem): ConfirmationStatus => {
  // Distinguish provisional ran_out (set agentically from Food Bank's heads-up email,
  // not yet verified at pickup) from committed ran_out (a volunteer at pickup
  // signed off via the cycle's Confirm action). Only the latter is terminal.
  // Provisional ran_out (ranOut=true, isConfirmed=false) is treated as
  // 'pending' so the normal pending → ran-low → ran-out cycle remains
  // available — the volunteer can override with what they actually received.
  // The cycle's commit RPCs (confirm_item_at_expected, update_allocations_
  // proportionally) clear ran_out automatically.
  if ((item.ranOut || item.receivedQuantity === 0) && item.isConfirmed) {
    return 'ran-out';
  }

  if (item.receivedQuantity !== null && item.receivedQuantity < item.expectedQuantity) {
    return item.receivedQuantity > 0 ? 'ran-low' : 'ran-out';
  }

  if (item.isConfirmed) {
    return 'expected';
  }

  return 'pending';
};

export const summarizeGroups = (groups: ConfirmationGroup[]) => {
  const totals = groups.reduce(
    (acc, group) => {
      group.items.forEach((item) => {
        const status = determineItemStatus(item);
        acc.total += 1;
        if (status === 'expected') {
          acc.confirmed += 1;
        } else if (status === 'ran-out') {
          acc.ranOut += 1;
        } else if (status === 'ran-low') {
          acc.ranLow += 1;
        }
      });
      return acc;
    },
    { confirmed: 0, ranLow: 0, ranOut: 0, total: 0 }
  );

  return totals;
};

export const buildConfirmationStatus = (items: OrderConfirmationItem[]): OrderConfirmationStatus => {
  const totals = summarizeGroups(groupConfirmationItems(items));
  return {
    totalItems: totals.total,
    confirmedItems: totals.confirmed,
    allConfirmed: totals.total > 0 && totals.confirmed === totals.total,
  };
};
