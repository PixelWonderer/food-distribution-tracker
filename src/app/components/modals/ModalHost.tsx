import React from 'react';

import { useModalManager } from '@/app/providers/ModalProvider';
import { DoorAccessSheet } from './DoorAccessSheet';
import { HelpDialog } from './HelpDialog';
import { QuickActionsSheet } from './QuickActionsSheet';
import { RanLowModal } from './RanLowModal';
import { ShareTrackerDialog } from './ShareTrackerDialog';
import { ItemDetailDialog } from './ItemDetailDialog';
import { PreferencesSheet } from './PreferencesSheet';
import { ScheduleManagementSheet } from './ScheduleManagementSheet';
import { ScheduleHistorySheet } from './ScheduleHistorySheet';
import { RedirectHistorySheet } from './RedirectHistorySheet';
import { DestinationManagementSheet } from './DestinationManagementSheet';
import { AddCustomItemSheet } from './AddCustomItemSheet';
import { RedirectItemSheet } from './RedirectItemSheet';
import { BankDestinationSheet } from './BankDestinationSheet';
import { BankItemSheet } from './BankItemSheet';
import { BankedItemsSheet } from './BankedItemsSheet';
import { ExtraAdminsSheet } from './ExtraAdminsSheet';
import { AdminToolsSheet } from '../AdminToolsSheet';
import { TutorialOverlay } from '../tutorial';
import { useTutorial } from '@/app/hooks/useTutorial';
import { useAppStore } from '@/services/state';

export const ModalHost: React.FC = () => {
  const bankedItemsCount = useAppStore((s) => s.bankedItems.length);
  const {
    ranLow,
    closeRanLow,
    quickActionsOpen,
    openHelp,
    closeQuickActions,
    helpOpen,
    closeHelp,
    shareOpen,
    openShare,
    closeShare,
    doorAccessOpen,
    openDoorAccess,
    closeDoorAccess,
    itemDetail,
    closeItemDetail,
    preferencesOpen,
    openPreferences,
    closePreferences,
    adminToolsOpen,
    openAdminTools,
    closeAdminTools,
    scheduleOpen,
    openSchedule,
    closeSchedule,
    scheduleHistoryOpen,
    openScheduleHistory,
    closeScheduleHistory,
    destinationManagementOpen,
    openDestinationManagement,
    closeDestinationManagement,
    addCustomItemOpen,
    openAddCustomItem,
    closeAddCustomItem,
    redirectItem,
    openRedirectItem,
    closeRedirectItem,
    redirectHistoryOpen,
    openRedirectHistory,
    closeRedirectHistory,
    // Banking modals
    bankDestinationOpen,
    openBankDestination,
    closeBankDestination,
    bankItem,
    closeBankItem,
    bankedItemsOpen,
    openBankedItems,
    closeBankedItems,
    // Extra admins
    extraAdminsOpen,
    openExtraAdmins,
    closeExtraAdmins,
  } = useModalManager();
  const { resumeOrStartTutorial } = useTutorial();

  return (
    <>
      <RanLowModal request={ranLow} open={Boolean(ranLow)} onClose={closeRanLow} />
      <QuickActionsSheet
        open={quickActionsOpen}
        onClose={closeQuickActions}
        onOpenHelp={openHelp}
        onOpenShare={openShare}
        onOpenDoorAccess={openDoorAccess}
        onOpenPreferences={openPreferences}
        onStartTutorial={() => resumeOrStartTutorial('demo')}
        onOpenExtraAdmins={openExtraAdmins}
      />
      <HelpDialog
        open={helpOpen}
        onClose={closeHelp}
        onStartTutorial={() => resumeOrStartTutorial('demo')}
      />
      <ShareTrackerDialog open={shareOpen} onClose={closeShare} />
      <DoorAccessSheet open={doorAccessOpen} onClose={closeDoorAccess} />
      <ItemDetailDialog
        request={itemDetail}
        open={Boolean(itemDetail)}
        onClose={closeItemDetail}
        onRedirect={(params) => {
          closeItemDetail();
          openRedirectItem({
            item: {
              row: params.row,
              name: params.itemName,
              quantity: params.quantity,
              emoji: params.emoji,
              isCustom: false,
              ranOut: false,
              colIndex: params.colIndex,
            },
            sourceDestinationName: params.destinationName,
            sourceDestinationId: params.destinationId,
            allocationId: params.allocationId,
          });
        }}
      />
      <PreferencesSheet open={preferencesOpen} onClose={closePreferences} />
      <AdminToolsSheet open={adminToolsOpen} onClose={closeAdminTools} />
      <ScheduleManagementSheet
        open={scheduleOpen}
        onClose={closeSchedule}
        onOpenHistory={openScheduleHistory}
      />
      <ScheduleHistorySheet open={scheduleHistoryOpen} onClose={closeScheduleHistory} />
      <RedirectHistorySheet open={redirectHistoryOpen} onClose={closeRedirectHistory} />
      <DestinationManagementSheet open={destinationManagementOpen} onClose={closeDestinationManagement} />
      <AddCustomItemSheet open={addCustomItemOpen} onClose={closeAddCustomItem} />
      <RedirectItemSheet open={Boolean(redirectItem)} onClose={closeRedirectItem} request={redirectItem} />
      {/* Banking modals */}
      <BankDestinationSheet open={bankDestinationOpen} onClose={closeBankDestination} />
      <BankItemSheet open={Boolean(bankItem)} onClose={closeBankItem} request={bankItem} />
      <BankedItemsSheet open={bankedItemsOpen} onClose={closeBankedItems} />
      {/* Extra admins */}
      <ExtraAdminsSheet
        open={extraAdminsOpen}
        onClose={closeExtraAdmins}
        onOpenAddCustomItem={openAddCustomItem}
        onOpenAdminTools={openAdminTools}
        onOpenBankDestination={openBankDestination}
        onOpenBankedItems={openBankedItems}
        onOpenSchedule={openSchedule}
        onOpenDestinationManagement={openDestinationManagement}
        onOpenRedirectHistory={openRedirectHistory}
        bankedItemsCount={bankedItemsCount}
      />
      <TutorialOverlay />
    </>
  );
};
