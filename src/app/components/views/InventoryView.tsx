import React, { useMemo } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';

import { useAppStore } from '@/services/state';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';
import {
  InventoryModeSelector,
  InventoryBrowseView,
  InventoryCountView,
  InventoryReorderView,
} from '@/app/components/inventory';

// ─────────────────────────────────────────────────────────────────────────────
// InventoryView - Persistent pantry inventory tracking with three modes
// Browse: Take items with attribution | Count: Physical inventory | Reorder: Suggestions
// ─────────────────────────────────────────────────────────────────────────────

export const InventoryView: React.FC = () => {
  const {
    inventoryViewMode,
    setInventoryViewMode,
    refreshInventory,
    isOnline,
    inventoryItems,
  } = useAppStore((state) => ({
    inventoryViewMode: state.inventoryViewMode,
    setInventoryViewMode: state.setInventoryViewMode,
    refreshInventory: state.refreshInventory,
    isOnline: state.isOnline,
    inventoryItems: state.inventoryItems,
  }));

  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshInventory();
    setIsRefreshing(false);
  };

  // Subtitle mirrors "142 items · 8 below par" shape from the design mock
  const { activeCount, belowParCount } = useMemo(() => {
    const active = inventoryItems.filter((i) => i.isActive);
    const belowPar = active.filter((i) => i.isLowStock || i.currentQuantity === 0);
    return { activeCount: active.length, belowParCount: belowPar.length };
  }, [inventoryItems]);

  return (
    <div className="space-y-3 pb-4">
      {/* Header — typographic hierarchy inspired by PhoneHeader in the design tokens */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Pantry
          </div>
          <h2 className="text-[22px] font-bold leading-tight tracking-tight text-slate-900">
            Inventory
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {activeCount} item{activeCount === 1 ? '' : 's'}
            {belowParCount > 0 && (
              <>
                <span className="mx-1.5 text-slate-300">·</span>
                <span className="text-[#B75A28]">{belowParCount} below par</span>
              </>
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="h-9 w-9 shrink-0 p-0"
          aria-label="Refresh inventory"
        >
          <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
        </Button>
      </div>

      {/* Offline banner */}
      {!isOnline && (
        <div className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>Offline mode — changes will sync when you have service</span>
        </div>
      )}

      {/* Mode selector: Browse | Count | Reorder */}
      <InventoryModeSelector
        mode={inventoryViewMode}
        onChange={setInventoryViewMode}
      />

      {/* Render appropriate view based on mode */}
      {inventoryViewMode === 'browse' && <InventoryBrowseView />}
      {inventoryViewMode === 'count' && <InventoryCountView />}
      {inventoryViewMode === 'reorder' && <InventoryReorderView />}
    </div>
  );
};

export default InventoryView;
