import React from 'react';
import { Chip } from '@/app/components/ui/chip';
import type { InventoryViewMode } from '@/types';

const MODES: Array<{ id: InventoryViewMode; label: string; icon: string }> = [
  { id: 'browse', label: 'Browse', icon: '📋' },
  { id: 'count', label: 'Count', icon: '✏️' },
  { id: 'reorder', label: 'Reorder', icon: '📦' },
];

type InventoryModeSelectorProps = {
  mode: InventoryViewMode;
  onChange: (mode: InventoryViewMode) => void;
};

// Mode switcher: matches the `InventoryBrowse` design source — active mode
// = indigo pastel pill (via Chip primitive). Hit target from compact density + padding.
export const InventoryModeSelector: React.FC<InventoryModeSelectorProps> = ({
  mode,
  onChange,
}) => {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Inventory mode">
      {MODES.map((m) => {
        const isActive = mode === m.id;
        return (
          <Chip
            key={m.id}
            tone="indigo"
            density="compact"
            active={isActive}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(m.id)}
            className="shrink-0"
            data-tutorial={`inventory-mode-${m.id}`}
          >
            <span aria-hidden>{m.icon}</span>
            <span>{m.label}</span>
          </Chip>
        );
      })}
    </div>
  );
};

export default InventoryModeSelector;
