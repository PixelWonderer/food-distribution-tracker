import React from 'react';
import { ChevronRight } from 'lucide-react';

import { Chip } from '@/app/components/ui/chip';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet';
import { useTutorial } from '@/app/hooks/useTutorial';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/services/state';
import { ROLE_CONFIG } from '@/app/utils/roles';
import type { VolunteerRole } from '@/types';

// Optional link to the source spreadsheet (set VITE_SOURCE_SHEET_URL in .env)
const SOURCE_SHEET_URL = (import.meta.env.VITE_SOURCE_SHEET_URL as string | undefined) || '';

type QuickActionsSheetProps = {
  open: boolean;
  onClose: () => void;
  onOpenHelp: () => void;
  onOpenShare: () => void;
  onOpenDoorAccess: () => void;
  onOpenPreferences?: () => void;
  onStartTutorial?: () => void;
  onOpenExtraAdmins?: () => void;
};

export const QuickActionsSheet: React.FC<QuickActionsSheetProps> = ({
  open,
  onClose,
  onOpenHelp,
  onOpenShare,
  onOpenDoorAccess,
  onOpenPreferences,
  onStartTutorial,
  onOpenExtraAdmins,
}) => {
  const { role, showShiftTasks, updatePreference } = useAppStore((state) => ({
    role: state.preferences.role,
    showShiftTasks: state.preferences.showShiftTasks,
    updatePreference: state.updatePreference,
  }));
  // Hide the "Interactive tutorial" entry while the tutorial is already
  // running — Gemini #8: showing the entry inside the tutorial is "Inception
  // UI" and confusing.
  const { isActive: tutorialActive } = useTutorial();

  const handle = (callback: () => void) => {
    callback();
    onClose();
  };

  const handleRoleChange = (newRole: VolunteerRole) => {
    updatePreference('role', newRole);
    updatePreference('hasCompletedRoleSetup', true);
    onClose();
  };

  const activeRoleConfig = role ? ROLE_CONFIG[role] : null;
  const roleSubtitle = activeRoleConfig
    ? `${activeRoleConfig.emoji} ${activeRoleConfig.shortName ?? activeRoleConfig.name}`
    : 'No role selected';

  return (
    <Sheet open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] gap-0 overflow-y-auto rounded-t-[24px] border-[#E2E5EC] bg-white p-0 shadow-[0_-20px_40px_rgba(0,0,0,0.2)]"
      >
        {/* Grabber */}
        <div className="flex justify-center pt-2" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-[#E2E5EC]" />
        </div>

        {/* Title + subtitle */}
        <SheetHeader className="gap-1 px-5 pb-2 pt-4 text-left">
          <SheetTitle className="text-[20px] font-bold tracking-[-0.3px] text-[#0E1020]">
            Quick Actions
          </SheetTitle>
          <p className="text-[13px] text-[#6B6F82]">{roleSubtitle}</p>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-5 pb-6 pt-2">
          {/* YOUR ROLE - Quick switcher */}
          <section className="flex flex-col gap-2">
            <SectionHeader>Your role</SectionHeader>
            <div className="grid grid-cols-4 gap-2 rounded-[14px] border border-[#E2E5EC] bg-[#F6F7FA] p-2">
              {(Object.keys(ROLE_CONFIG) as VolunteerRole[]).map((roleId) => {
                const config = ROLE_CONFIG[roleId];
                const isActive = role === roleId;
                return (
                  <button
                    key={roleId}
                    type="button"
                    onClick={() => handleRoleChange(roleId)}
                    className={cn(
                      'flex min-h-11 flex-col items-center gap-1 rounded-[10px] border px-2 py-2 text-center transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46FF] focus-visible:ring-offset-2',
                      isActive
                        ? 'border-[#CFC9FF] bg-[#E8E6FF] text-[#3B33D4]'
                        : 'border-transparent bg-white text-[#6B6F82] hover:border-[#E2E5EC]'
                    )}
                    aria-pressed={isActive}
                  >
                    <span className="text-lg leading-none" aria-hidden>
                      {config.emoji}
                    </span>
                    <span className="text-[10px] font-semibold leading-tight">
                      {config.shortName}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* EVERYDAY */}
          <section className="flex flex-col gap-1">
            <SectionHeader>Everyday</SectionHeader>
            <ActionRow
              icon="🔐"
              iconTone="saffron"
              title="Door Unlock Code"
              description="Access storage area"
              onClick={() => handle(onOpenDoorAccess)}
              dataTutorial="door-unlock-qam"
              accent
            />
            <ActionRow
              icon="📱"
              iconTone="indigo"
              title="Share Link"
              description="Share tracker with volunteers"
              onClick={() => handle(onOpenShare)}
            />
            <ActionRow
              icon="📊"
              iconTone="slate"
              title="View Source Sheet"
              description="Open the data spreadsheet"
              external
              disabled={!SOURCE_SHEET_URL}
              onClick={() => {
                if (!SOURCE_SHEET_URL) return;
                window.open(SOURCE_SHEET_URL, '_blank', 'noopener,noreferrer');
                onClose();
              }}
            />
            <ActionRow
              icon="📋"
              iconTone="saffron"
              title="Shift Tasks"
              description={showShiftTasks ? 'Showing in Pickup tab' : 'Hidden from Pickup tab'}
              badge={showShiftTasks ? 'On' : 'Off'}
              badgeTone={showShiftTasks ? 'mint' : 'slate'}
              onClick={() => {
                updatePreference('showShiftTasks', !showShiftTasks);
                updatePreference('hasSeenShiftTasksIntro', true);
                onClose();
              }}
            />
          </section>

          {/* DATA */}
          <section className="flex flex-col gap-1">
            <SectionHeader>Data</SectionHeader>
            <ActionRow
              icon="🔄"
              iconTone="rose"
              title="Clear & Import Data"
              description="Reset and reimport from Google Sheets"
              onClick={async () => {
                if (window.confirm('⚠️ This will clear all tracking data and reimport from Google Sheets. Continue?')) {
                  try {
                    const googleSync = (window as unknown as { googleSync?: { importToSupabase: () => Promise<{ success: boolean; ordersProcessed: number; allocationsCreated: number; inventoryImported: number; warnings?: string[]; errors: string[] }> } }).googleSync;
                    if (!googleSync) {
                      alert('❌ Google Sheets sync service not available');
                      return;
                    }
                    const result = await googleSync.importToSupabase();
                    if (result.success) {
                      let message = `✅ Import successful!\n\n${result.ordersProcessed} orders imported\n${result.allocationsCreated} allocations created`;
                      if (result.inventoryImported > 0) {
                        message += `\n${result.inventoryImported} items added to inventory`;
                      }
                      if (result.warnings && result.warnings.length > 0) {
                        message += `\n\n⚠️ Warnings:\n${result.warnings.join('\n')}`;
                      }
                      alert(message);
                      window.location.reload();
                    } else {
                      let errorMsg = `❌ Import failed: ${result.errors.join(', ')}`;
                      if (result.warnings && result.warnings.length > 0) {
                        errorMsg += `\n\n⚠️ Warnings:\n${result.warnings.join('\n')}`;
                      }
                      alert(errorMsg);
                    }
                  } catch (error) {
                    alert(`❌ Import error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  }
                }
                onClose();
              }}
            />
          </section>

// Optional link to the source spreadsheet (set VITE_SOURCE_SHEET_URL in .env)
const SOURCE_SHEET_URL = (import.meta.env.VITE_SOURCE_SHEET_URL as string | undefined) || '';

          {/* HELP */}
          <section className="flex flex-col gap-1">
            <SectionHeader>Help</SectionHeader>
            {!tutorialActive && (
              <ActionRow
                icon="🎯"
                iconTone="indigo"
                title="Interactive tutorial"
                description="Step-by-step walkthrough with highlights"
                onClick={() => handle(onStartTutorial ?? (() => {}))}
                disabled={!onStartTutorial}
              />
            )}
            <ActionRow
              icon="❓"
              iconTone="indigo"
              title="Help & Documentation"
              description="Learn how to use the tracker"
              onClick={() => handle(onOpenHelp)}
            />
            <ActionRow
              icon="⚙️"
              iconTone="saffron"
              title="Preferences"
              description="Layout, filters, and volunteer name"
              onClick={() => handle(onOpenPreferences ?? (() => {}))}
              disabled={!onOpenPreferences}
              badge={onOpenPreferences ? undefined : 'Soon'}
              badgeTone="slate"
            />
          </section>

          {/* TOOLS */}
          <section className="flex flex-col gap-1">
            <SectionHeader>Tools</SectionHeader>
            <ActionRow
              icon="🔧"
              iconTone="slate"
              title="Extra Admin Tools"
              description="Custom items, banking, schedules, and more"
              onClick={() => handle(onOpenExtraAdmins ?? (() => {}))}
              disabled={!onOpenExtraAdmins}
            />
          </section>

          {/* Version footer */}
          <div className="rounded-[14px] border border-dashed border-[#CFC9FF] bg-[#E8E6FF]/30 p-4 text-[13px] text-[#6B6F82]">
            <p className="font-semibold text-[#3B33D4]">Food Tracker</p>
            <p>Version 2.0 • Open-source tool for community food-distribution volunteers.</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

type ActionIconTone = 'indigo' | 'saffron' | 'slate' | 'rose' | 'mint';

const ICON_TONES: Record<ActionIconTone, string> = {
  indigo: 'bg-[#E8E6FF] text-[#3B33D4]',
  saffron: 'bg-[#FFF5D1] text-[#C99B00]',
  slate: 'bg-[#F0F2F6] text-[#373B4F]',
  rose: 'bg-[#FFE4E9] text-[#E11D48]',
  mint: 'bg-[#E9FFF4] text-[#0F7A4F]',
};

type BadgeTone = 'slate' | 'mint' | 'saffron';

type ActionRowProps = {
  icon: string;
  iconTone: ActionIconTone;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  external?: boolean;
  badge?: string;
  badgeTone?: BadgeTone;
  dataTutorial?: string;
  /** Saffron accent border + lift for weekly-rhythm primary actions (e.g. Door Access). */
  accent?: boolean;
};

const ActionRow: React.FC<ActionRowProps> = ({
  icon,
  iconTone,
  title,
  description,
  onClick,
  disabled = false,
  external = false,
  badge,
  badgeTone = 'slate',
  dataTutorial,
  accent = false,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-tutorial={dataTutorial}
      className={cn(
        'flex w-full items-center gap-3 rounded-[14px] border px-3 py-2.5 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46FF] focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-55',
        accent
          ? 'border-[#F8D979] bg-[#FFF5D1]/60 hover:bg-[#FFF5D1]'
          : 'border-[#E2E5EC] bg-white hover:bg-[#F6F7FA]'
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-flex size-11 shrink-0 items-center justify-center rounded-[12px] text-xl',
          ICON_TONES[iconTone]
        )}
      >
        {icon}
      </span>
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <span className="text-[15px] font-semibold leading-tight text-[#0E1020]">
          {title}
        </span>
        <span className="truncate text-[11px] text-[#6B6F82]">{description}</span>
      </div>
      {badge ? (
        <Chip tone={badgeTone} density="tag" aria-disabled="true" tabIndex={-1}>
          {badge}
        </Chip>
      ) : null}
      {external ? (
        <span aria-hidden className="text-[#9498A8]">↗</span>
      ) : (
        !badge && (
          <ChevronRight
            aria-hidden
            className="size-4 shrink-0 text-[#9498A8]"
            strokeWidth={2.5}
          />
        )
      )}
    </button>
  );
};

const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-1 pb-1 pt-2 first:pt-0">
    <span className="text-[11px] font-bold uppercase tracking-[1.2px] text-[#6B6F82]">
      {children}
    </span>
  </div>
);
