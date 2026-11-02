import React from 'react';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet';
import { cn } from '@/lib/utils';

type ExtraAdminsSheetProps = {
  open: boolean;
  onClose: () => void;
  onOpenAddCustomItem?: () => void;
  onOpenAdminTools?: () => void;
  onOpenBankDestination?: () => void;
  onOpenBankedItems?: () => void;
  onOpenSchedule?: () => void;
  onOpenDestinationManagement?: () => void;
  onOpenRedirectHistory?: () => void;
  bankedItemsCount?: number;
};

const ACTION_ICON_CLASSES =
  'inline-flex size-12 items-center justify-center rounded-xl bg-gradient-to-br text-xl shadow-[0_12px_30px_rgba(15,23,42,0.12)]';

export const ExtraAdminsSheet: React.FC<ExtraAdminsSheetProps> = ({
  open,
  onClose,
  onOpenAddCustomItem,
  onOpenAdminTools,
  onOpenBankDestination,
  onOpenBankedItems,
  onOpenSchedule,
  onOpenDestinationManagement,
  onOpenRedirectHistory,
  bankedItemsCount = 0,
}) => {
  const handle = (callback: () => void) => {
    callback();
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] gap-3 overflow-y-auto rounded-t-[32px] border-border/70 bg-card p-4 shadow-[0_-28px_90px_rgba(15,23,42,0.16)]"
      >
        <SheetHeader className="gap-1">
          <div className="mx-auto h-1 w-12 rounded-full bg-muted" aria-hidden />
          <SheetTitle className="text-base font-semibold text-muted-foreground">Extra Admin Tools</SheetTitle>
        </SheetHeader>

        <div className="space-y-2">
          {/* MANAGE ITEMS */}
          <SectionHeader>Manage Items</SectionHeader>
          <ActionRow
            icon="📦"
            iconClassName="from-lime-100 via-white to-lime-50"
            title="Add Custom Item"
            description="Add supplies like forks, meal boxes, etc."
            onClick={() => handle(onOpenAddCustomItem ?? (() => {}))}
            disabled={!onOpenAddCustomItem}
          />
          <ActionRow
            icon="👥"
            iconClassName="from-red-100 via-white to-red-50"
            title="Surplus groups"
            description="Remove surplus distribution groups"
            onClick={() => handle(onOpenAdminTools ?? (() => {}))}
            disabled={!onOpenAdminTools}
          />
          <ActionRow
            icon="🏦"
            iconClassName="from-indigo-100 via-white to-purple-50"
            title="Bank Items for Next Week"
            description="Save items for future distribution"
            onClick={() => handle(onOpenBankDestination ?? (() => {}))}
            disabled={!onOpenBankDestination}
          />
          <ActionRow
            icon="📋"
            iconClassName="from-purple-100 via-white to-indigo-50"
            title="View Banked Items"
            description="See items saved for next week"
            onClick={() => handle(onOpenBankedItems ?? (() => {}))}
            disabled={!onOpenBankedItems}
            badge={bankedItemsCount > 0 ? String(bankedItemsCount) : undefined}
          />

          {/* ADMIN */}
          <SectionHeader>Admin</SectionHeader>
          <ActionRow
            icon="📅"
            iconClassName="from-cyan-100 via-white to-cyan-50"
            title="Manage Schedule"
            description="Change delivery days and times"
            onClick={() => handle(onOpenSchedule ?? (() => {}))}
            disabled={!onOpenSchedule}
          />
          <ActionRow
            icon="📍"
            iconClassName="from-orange-100 via-white to-orange-50"
            title="Manage Destinations"
            description="Add custom destinations for ad-hoc pickups"
            onClick={() => handle(onOpenDestinationManagement ?? (() => {}))}
            disabled={!onOpenDestinationManagement}
          />
          <ActionRow
            icon="🔀"
            iconClassName="from-violet-100 via-white to-violet-50"
            title="View Redirect History"
            description="See all item redirects this week"
            onClick={() => handle(onOpenRedirectHistory ?? (() => {}))}
            disabled={!onOpenRedirectHistory}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};

type ActionRowProps = {
  icon: string;
  iconClassName: string;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  badge?: string;
};

const ActionRow: React.FC<ActionRowProps> = ({
  icon,
  iconClassName,
  title,
  description,
  onClick,
  disabled = false,
  badge,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-3 rounded-3xl border border-transparent bg-white p-3 text-left shadow-sm transition hover:-translate-y-[1px] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
        'bg-gradient-to-br from-white via-white to-slate-50'
      )}
    >
      <span className={cn(ACTION_ICON_CLASSES, iconClassName)} aria-hidden>
        {icon}
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      {badge ? (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {badge}
        </span>
      ) : null}
    </button>
  );
};

const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-1 pt-4 pb-1 first:pt-0">
    <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground/70">
      {children}
    </span>
  </div>
);
