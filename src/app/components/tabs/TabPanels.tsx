import React from 'react';
import { useAppStore } from '@/services/state';
import { ConfirmationView } from '../views/ConfirmationView';
import { StorageView } from '../views/StorageView';
import { PickupView } from '../views/PickupView';
import { cn } from '@/lib/utils';
import { InventoryView } from '../views/InventoryView';

export const TabPanels: React.FC = () => {
  const currentTab = useAppStore((state) => state.currentTab);
  const contentPadding = currentTab === 'pickup' ? 'pt-8' : 'pt-4';

  return (
    <section className={cn('flex flex-col gap-6 transition-all', contentPadding)} aria-live="polite">
      {currentTab === 'orderConfirmation' && <ConfirmationView />}
      {currentTab === 'storage' && <StorageView />}
      {currentTab === 'pickup' && <PickupView />}
      {currentTab === 'inventory' && <InventoryView />}
    </section>
  );
};
