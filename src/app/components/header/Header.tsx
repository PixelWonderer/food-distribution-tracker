import React, { useMemo, useState, useEffect, useRef } from 'react';
import { MoreVertical, RotateCcw, Unlock } from 'lucide-react';

import { IconButton } from '@/app/components/ui/icon-button';
import { useModalManager } from '@/app/providers/ModalProvider';
import { useAppStore } from '@/services/state';
import { cn } from '@/lib/utils';
import { usePickupTabsRenderer } from '@/app/providers/PickupTabsAnchorProvider';
import { toast } from '@/lib/toast';
import { doorUnlockService } from '@/services/n8nDoorService';
import { ROLE_CONFIG } from '@/app/utils/roles';

const parseLocalDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  return new Date(value);
};

const formatWeekDate = (value: string | null) => {
  if (!value) {
    return null;
  }

  const parsed = parseLocalDate(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatSmartStatus = (
  isOnline: boolean,
  isSyncing: boolean,
  syncError: string | null,
  lastSyncTime: number | null,
  realtimeStatus: 'connected' | 'disconnected' | 'error' | 'polling',
  syncMethod: 'realtime' | 'polling' | 'manual' | 'unknown'
): { label: string; dotClass: string; tooltip?: string } => {
  if (syncError && realtimeStatus !== 'polling') {
    return {
      label: 'Retry queued',
      dotClass: 'bg-[#E11D48]',
      tooltip: syncError,
    };
  }

  if (isSyncing) {
    return { label: 'Syncing', dotClass: 'bg-[#C99B00] pulse-breathe' };
  }

  if (!isOnline) {
    return { label: 'Offline', dotClass: 'bg-[#9498A8]' };
  }

  // Real-time connected - breathing green dot
  if (realtimeStatus === 'connected' && syncMethod === 'realtime') {
    if (!lastSyncTime || Date.now() - lastSyncTime < 5_000) {
      return {
        label: 'Live',
        dotClass: 'bg-[#059669] pulse-breathe',
        tooltip: 'Real-time sync active — updates appear instantly',
      };
    }
  }

  // Polling mode — calm pulse on indigo
  if (syncMethod === 'polling' || realtimeStatus === 'polling') {
    return {
      label: 'Polling',
      dotClass: 'bg-[#4F46FF] pulse-breathe',
      tooltip: 'Fallback polling — updates every 30–60 seconds',
    };
  }

  // Disconnected but not yet polling — fold into Polling state (same user-facing semantics)
  if (realtimeStatus === 'disconnected') {
    return {
      label: 'Polling',
      dotClass: 'bg-[#4F46FF] pulse-breathe',
      tooltip: 'Real-time sync reconnecting — falling back to polling',
    };
  }

  // Connected - show last sync time
  if (!lastSyncTime) {
    return { label: 'Connected', dotClass: 'bg-[#059669]' };
  }

  const delta = Date.now() - lastSyncTime;

  // Less than 60 seconds: show "Synced just now" or "Synced 30s ago" — keep calm green breath
  if (delta < 60_000) {
    if (delta < 5_000) {
      return { label: 'Synced just now', dotClass: 'bg-[#059669] pulse-breathe' };
    }
    const seconds = Math.round(delta / 1_000);
    return { label: `Synced ${seconds}s ago`, dotClass: 'bg-[#059669] pulse-breathe' };
  }

  // Less than 60 minutes: show "Synced 2m ago"
  if (delta < 3_600_000) {
    const minutes = Math.round(delta / 60_000);
    return { label: `Synced ${minutes}m ago`, dotClass: 'bg-[#059669]' };
  }

  // 60+ minutes: show "Synced at 2:45 PM"
  const time = new Date(lastSyncTime).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return { label: `Synced at ${time}`, dotClass: 'bg-[#059669]' };
};

export const Header: React.FC = () => {
  const {
    currentWeekDate,
    isSyncing,
    syncError,
    lastSyncTime,
    isOnline,
    fetchData,
    realtimeStatus,
    syncMethod,
    isDemoMode,
    role,
  } = useAppStore((state) => ({
    currentWeekDate: state.currentWeekDate,
    isSyncing: state.isSyncing,
    syncError: state.syncError,
    lastSyncTime: state.lastSyncTime,
    isOnline: state.isOnline,
    fetchData: state.fetchData,
    realtimeStatus: state.realtimeStatus,
    syncMethod: state.syncMethod,
    isDemoMode: state.isDemoMode,
    role: state.preferences.role,
  }));
  const { openQuickActions, openDoorAccess } = useModalManager();
  const pickupTabsRenderer = usePickupTabsRenderer();
  const syncTimeoutRef = useRef<number | null>(null);

  // Add a state variable that updates at progressive intervals for efficient timestamp display
  const [now, setNow] = useState(Date.now());

  // Quick unlock state
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [quickUnlockMessage, setQuickUnlockMessage] = useState<string | null>(null);
  const [quickUnlockFailures, setQuickUnlockFailures] = useState(0);
  const [quickCountdown, setQuickCountdown] = useState<number | null>(null);
  const [quickStatusColor, setQuickStatusColor] = useState<string | null>(null);

  useEffect(() => {
    // Calculate the next milestone and schedule update accordingly
    const scheduleNextUpdate = () => {
      if (!lastSyncTime) return null;

      const delta = Date.now() - lastSyncTime;

      // Progressive intervals based on time elapsed
      let nextDelay: number;

      if (delta < 5_000) {
        // Jump from "just now" to "10s ago" in 5 seconds
        nextDelay = 5_000 - delta;
      } else if (delta < 60_000) {
        // Jump every 10 seconds: 10s, 20s, 30s, 40s, 50s
        const nextMilestone = Math.ceil(delta / 10_000) * 10_000;
        nextDelay = nextMilestone - delta;
      } else if (delta < 3_600_000) {
        // Jump every minute: 1m, 2m, 3m, etc.
        const nextMilestone = Math.ceil(delta / 60_000) * 60_000;
        nextDelay = nextMilestone - delta;
      } else {
        // After 1 hour, no need to update (shows "Synced at [time]")
        return null;
      }

      return Math.max(nextDelay, 100); // Minimum 100ms delay
    };

    const setupTimer = () => {
      const delay = scheduleNextUpdate();
      if (delay === null) return;

      const timeoutId = setTimeout(() => {
        setNow(Date.now());
        setupTimer(); // Schedule next update
      }, delay);

      return timeoutId;
    };

    const timeoutId = setupTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [lastSyncTime, now]); // Re-run when lastSyncTime or now changes

  // Safety net: clear stuck isSyncing after 30s
  useEffect(() => {
    if (isSyncing) {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      syncTimeoutRef.current = window.setTimeout(() => {
        useAppStore.setState({ isSyncing: false });
        toast.info('Sync timed out — data may be stale. Pull down to refresh.', 6000);
      }, 30_000);
    } else if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    };
  }, [isSyncing]);

  const formattedWeek = useMemo(() => formatWeekDate(currentWeekDate), [currentWeekDate]);
  const smartStatus = useMemo(
    () => formatSmartStatus(isOnline, isSyncing, syncError, lastSyncTime, realtimeStatus, syncMethod),
    [isOnline, isSyncing, lastSyncTime, syncError, realtimeStatus, syncMethod, now] // Add new dependencies
  );

  // Quick unlock handler
  const handleQuickUnlock = async () => {
    // Check if credentials are saved
    if (!doorUnlockService.hasCredentials) {
      // No credentials → open modal
      openDoorAccess();
      return;
    }

    // Has credentials → quick unlock
    setIsUnlocking(true);
    setQuickUnlockMessage('Unlocking…');
    setQuickCountdown(null);
    setQuickStatusColor('bg-blue-500');

    try {
      const result = await doorUnlockService.triggerUnlock();
      if (result.success) {
        const user = result.user ? ` (${result.user})` : '';
        setQuickUnlockMessage(`Unlocked${user}`);
        setQuickCountdown(2);
        setQuickUnlockFailures(0);
        setQuickStatusColor('bg-green-500');
        const interval = setInterval(() => {
          setQuickCountdown((prev) => {
            if (prev === null || prev <= 1) {
              clearInterval(interval);
              setQuickUnlockMessage('Door re-locked. Tap unlock to open again.');
              setQuickStatusColor('bg-slate-400');
              setTimeout(() => {
                setQuickUnlockMessage(null);
                setQuickStatusColor(null);
              }, 3000);
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        const suffix =
          quickUnlockFailures >= 1
            ? ' Check creds or use the door URL in the unlock panel.'
            : ' Check your username/password.';
        const nextFailures = quickUnlockFailures + 1;
        setQuickUnlockFailures(nextFailures);
        setQuickUnlockMessage(`Load failed.${suffix}`);
        setQuickStatusColor('bg-red-500');
        if (nextFailures >= 2) {
          openDoorAccess();
        }
      }
    } catch (_error) {
      const suffix =
        quickUnlockFailures >= 1
          ? ' Check creds or use the door URL in the unlock panel.'
          : ' Check your username/password.';
      const nextFailures = quickUnlockFailures + 1;
      setQuickUnlockFailures(nextFailures);
      setQuickUnlockMessage(`Load failed. ${suffix}`);
      setQuickStatusColor('bg-red-500');
      if (nextFailures >= 2) {
        openDoorAccess();
      }
    } finally {
      setIsUnlocking(false);

      // Clear message after 4 seconds if no countdown is running
      if (quickCountdown === null) {
        setTimeout(() => {
          setQuickUnlockMessage(null);
          setQuickStatusColor(null);
        }, 4000);
      }
    }
  };

  return (
    <header
      className="sticky top-0 z-40 w-full shrink-0 border-b border-transparent bg-white shadow-[0_10px_25px_rgba(15,23,42,0.08)] relative overflow-visible after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-4 after:h-6 after:bg-gradient-to-b after:from-white after:to-transparent"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="px-4 pb-2 pt-1">
        {/* Row 1: Logo + Title | Sync + Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden>
              🍜
            </span>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold leading-none text-slate-900">Food Tracker</span>
                {isDemoMode && (
                  <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-purple-700">
                    Demo
                  </span>
                )}
                {role && role !== 'fullAccess' && ROLE_CONFIG[role] && (
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                    {ROLE_CONFIG[role].emoji} {ROLE_CONFIG[role].name.split(' ')[0]}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Community</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600"
              aria-live="polite"
              title={quickUnlockMessage || smartStatus.tooltip}
            >
              {quickUnlockMessage ? (
                <>
                  <span
                    className={cn(
                      'size-2 rounded-full animate-pulse',
                      quickStatusColor || 'bg-blue-500'
                    )}
                    aria-hidden
                  />
                  {quickCountdown !== null ? `${quickUnlockMessage} (${quickCountdown}s)` : quickUnlockMessage}
                </>
              ) : (
                <>
                  <span className={cn('size-2 rounded-full', smartStatus.dotClass)} aria-hidden />
                  {smartStatus.label}
                </>
              )}
            </span>
            <IconButton
              variant="ghost"
              size="sm"
              bordered
              aria-label="Refresh data"
              onClick={() => void fetchData()}
              disabled={isSyncing}
            >
              <RotateCcw className="size-4" aria-hidden />
            </IconButton>
            <IconButton
              variant="ghost"
              size="sm"
              bordered
              aria-label="Unlock warehouse door"
              onClick={handleQuickUnlock}
              disabled={isUnlocking}
              data-tutorial="door-unlock-header"
            >
              <Unlock className="size-4" aria-hidden />
            </IconButton>
            <IconButton
              variant="ghost"
              size="sm"
              bordered
              aria-label="Open tracker menu"
              onClick={openQuickActions}
              data-tutorial="quick-actions-button"
            >
              <MoreVertical className="size-4" aria-hidden />
            </IconButton>
          </div>
        </div>

        <div className="mt-2 -mx-4 px-0">
          <div className="relative bg-white px-4 pb-2 pt-1">
            <div className="flex justify-center">
              <span className="text-xs font-semibold text-slate-700">
                Pickup date: {formattedWeek ?? 'Syncing week…'}
              </span>
            </div>
            <div
              id="pickup-tabs-anchor"
              className="mt-3 w-full -mx-1 px-1 empty:hidden"
              aria-live="polite"
              aria-label="Pickup destination tabs"
            >
              {pickupTabsRenderer ? pickupTabsRenderer() : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
