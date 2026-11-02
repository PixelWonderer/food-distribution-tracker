import React, { createContext, useContext, useMemo, useState, PropsWithChildren } from 'react';
import type { OrderConfirmationItem, BankItemRequest } from '@/types';
import type { RedirectItemRequest } from '@/app/components/modals/RedirectItemSheet';

export type ItemDetailRequest = {
  itemName: string;
  sheetRow?: number | null;
  emoji?: string;
  unit?: string | null;
  expectedQuantity?: number | null;
  receivedQuantity?: number | null;
  storageType?: string | null;
  source?: 'confirmation' | 'storage' | 'pickup';
  mode?: 'confirmation' | 'storage' | 'pickup';
};

type RanLowRequest = {
  item: OrderConfirmationItem;
  onSubmit: (quantity: number) => Promise<void> | void;
};

type ModalContextValue = {
  ranLow: RanLowRequest | null;
  openRanLow: (request: RanLowRequest) => void;
  closeRanLow: () => void;
  quickActionsOpen: boolean;
  openQuickActions: () => void;
  closeQuickActions: () => void;
  helpOpen: boolean;
  openHelp: () => void;
  closeHelp: () => void;
  shareOpen: boolean;
  openShare: () => void;
  closeShare: () => void;
  doorAccessOpen: boolean;
  openDoorAccess: () => void;
  closeDoorAccess: () => void;
  itemDetail: ItemDetailRequest | null;
  openItemDetail: (request: ItemDetailRequest) => void;
  closeItemDetail: () => void;
  preferencesOpen: boolean;
  openPreferences: () => void;
  closePreferences: () => void;
  adminToolsOpen: boolean;
  openAdminTools: () => void;
  closeAdminTools: () => void;
  scheduleOpen: boolean;
  openSchedule: () => void;
  closeSchedule: () => void;
  scheduleHistoryOpen: boolean;
  openScheduleHistory: () => void;
  closeScheduleHistory: () => void;
  destinationManagementOpen: boolean;
  openDestinationManagement: () => void;
  closeDestinationManagement: () => void;
  addCustomItemOpen: boolean;
  openAddCustomItem: () => void;
  closeAddCustomItem: () => void;
  redirectItem: RedirectItemRequest | null;
  openRedirectItem: (request: RedirectItemRequest) => void;
  closeRedirectItem: () => void;
  redirectHistoryOpen: boolean;
  openRedirectHistory: () => void;
  closeRedirectHistory: () => void;
  // Banking modals
  bankDestinationOpen: boolean;
  openBankDestination: () => void;
  closeBankDestination: () => void;
  bankItem: BankItemRequest | null;
  openBankItem: (request: BankItemRequest) => void;
  closeBankItem: () => void;
  bankedItemsOpen: boolean;
  openBankedItems: () => void;
  closeBankedItems: () => void;
  // Extra admins
  extraAdminsOpen: boolean;
  openExtraAdmins: () => void;
  closeExtraAdmins: () => void;
};

const ModalContext = createContext<ModalContextValue | undefined>(undefined);

export const ModalProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [ranLow, setRanLow] = useState<RanLowRequest | null>(null);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [doorAccessOpen, setDoorAccessOpen] = useState(false);
  const [itemDetail, setItemDetail] = useState<ItemDetailRequest | null>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [adminToolsOpen, setAdminToolsOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleHistoryOpen, setScheduleHistoryOpen] = useState(false);
  const [destinationManagementOpen, setDestinationManagementOpen] = useState(false);
  const [addCustomItemOpen, setAddCustomItemOpen] = useState(false);
  const [redirectItem, setRedirectItem] = useState<RedirectItemRequest | null>(null);
  const [redirectHistoryOpen, setRedirectHistoryOpen] = useState(false);
  // Banking modals
  const [bankDestinationOpen, setBankDestinationOpen] = useState(false);
  const [bankItem, setBankItem] = useState<BankItemRequest | null>(null);
  const [bankedItemsOpen, setBankedItemsOpen] = useState(false);
  // Extra admins
  const [extraAdminsOpen, setExtraAdminsOpen] = useState(false);

  const value = useMemo<ModalContextValue>(
    () => ({
      ranLow,
      openRanLow: (request: RanLowRequest) => setRanLow(request),
      closeRanLow: () => setRanLow(null),
      quickActionsOpen,
      openQuickActions: () => {
        setQuickActionsOpen(true);
        setHelpOpen(false);
        setShareOpen(false);
        setDoorAccessOpen(false);
      },
      closeQuickActions: () => setQuickActionsOpen(false),
      helpOpen,
      openHelp: () => {
        setHelpOpen(true);
        setQuickActionsOpen(false);
      },
      closeHelp: () => setHelpOpen(false),
      shareOpen,
      openShare: () => {
        setShareOpen(true);
        setQuickActionsOpen(false);
      },
      closeShare: () => setShareOpen(false),
      doorAccessOpen,
      openDoorAccess: () => {
        setDoorAccessOpen(true);
        setQuickActionsOpen(false);
      },
      closeDoorAccess: () => setDoorAccessOpen(false),
      itemDetail,
      openItemDetail: (request: ItemDetailRequest) => setItemDetail(request),
      closeItemDetail: () => setItemDetail(null),
      preferencesOpen,
      openPreferences: () => {
        setPreferencesOpen(true);
        setQuickActionsOpen(false);
      },
      closePreferences: () => setPreferencesOpen(false),
      adminToolsOpen,
      openAdminTools: () => {
        setAdminToolsOpen(true);
        setQuickActionsOpen(false);
      },
      closeAdminTools: () => setAdminToolsOpen(false),
      scheduleOpen,
      openSchedule: () => {
        setScheduleOpen(true);
        setQuickActionsOpen(false);
      },
      closeSchedule: () => setScheduleOpen(false),
      scheduleHistoryOpen,
      openScheduleHistory: () => {
        setScheduleHistoryOpen(true);
        setScheduleOpen(false);
      },
      closeScheduleHistory: () => setScheduleHistoryOpen(false),
      destinationManagementOpen,
      openDestinationManagement: () => {
        setDestinationManagementOpen(true);
        setQuickActionsOpen(false);
      },
      closeDestinationManagement: () => setDestinationManagementOpen(false),
      addCustomItemOpen,
      openAddCustomItem: () => {
        setAddCustomItemOpen(true);
        setQuickActionsOpen(false);
      },
      closeAddCustomItem: () => setAddCustomItemOpen(false),
      redirectItem,
      openRedirectItem: (request: RedirectItemRequest) => setRedirectItem(request),
      closeRedirectItem: () => setRedirectItem(null),
      redirectHistoryOpen,
      openRedirectHistory: () => {
        setRedirectHistoryOpen(true);
        setQuickActionsOpen(false);
      },
      closeRedirectHistory: () => setRedirectHistoryOpen(false),
      // Banking modals
      bankDestinationOpen,
      openBankDestination: () => {
        setBankDestinationOpen(true);
        setQuickActionsOpen(false);
      },
      closeBankDestination: () => setBankDestinationOpen(false),
      bankItem,
      openBankItem: (request: BankItemRequest) => setBankItem(request),
      closeBankItem: () => setBankItem(null),
      bankedItemsOpen,
      openBankedItems: () => {
        setBankedItemsOpen(true);
        setQuickActionsOpen(false);
      },
      closeBankedItems: () => setBankedItemsOpen(false),
      // Extra admins
      extraAdminsOpen,
      openExtraAdmins: () => {
        setExtraAdminsOpen(true);
        setQuickActionsOpen(false);
      },
      closeExtraAdmins: () => setExtraAdminsOpen(false),
    }),
    [addCustomItemOpen, adminToolsOpen, bankDestinationOpen, bankItem, bankedItemsOpen, destinationManagementOpen, doorAccessOpen, extraAdminsOpen, helpOpen, itemDetail, preferencesOpen, quickActionsOpen, ranLow, redirectHistoryOpen, redirectItem, scheduleHistoryOpen, scheduleOpen, shareOpen]
  );

  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
};

export const useModalManager = (): ModalContextValue => {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error('useModalManager must be used within a ModalProvider');
  }
  return ctx;
};
