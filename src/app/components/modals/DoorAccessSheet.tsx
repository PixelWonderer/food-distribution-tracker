import React, { useEffect, useMemo, useState } from 'react';

import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet';
import { doorUnlockService, type DoorUnlockConfig } from '@/services/n8nDoorService';

type DoorAccessSheetProps = {
  open: boolean;
  onClose: () => void;
};

type StatusVariant = 'info' | 'success' | 'error' | 'warning';

type Status = {
  message: string;
  variant: StatusVariant;
};

type UIState = 'ready' | 'unlocked' | 'locked' | 'nocreds';

export const DoorAccessSheet: React.FC<DoorAccessSheetProps> = ({ open, onClose }) => {
  const [config, setConfig] = useState<DoorUnlockConfig>(() => doorUnlockService.currentConfig);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [unlockStatus, setUnlockStatus] = useState<Status | null>(null);
  const [configStatus, setConfigStatus] = useState<Status | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [failureCount, setFailureCount] = useState(0);
  const [showCredentials, setShowCredentials] = useState(false);

  useEffect(() => {
    const unsubscribe = doorUnlockService.subscribe((nextConfig) => {
      setConfig(nextConfig);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const current = doorUnlockService.currentConfig;
    setConfig(current);
    setUsername(current.username ?? '');
    setPassword('');
    setCountdown(null);
    setFailureCount(0);
    setShowCredentials(!current.username);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setConfigStatus(
      config.username
        ? { message: `Saved as ${config.username}`, variant: 'info' }
        : { message: 'No credentials saved yet.', variant: 'warning' }
    );
    setUnlockStatus(generateUnlockStatus(config));
  }, [config, open]);

  const hasStoredPassword = Boolean(config.password);
  const hasUnlockCredentials = Boolean(config.username && config.password);

  // Compute UI state for the big circular button
  const uiState: UIState = useMemo(() => {
    if (!hasUnlockCredentials) return 'nocreds';
    if (unlockStatus?.variant === 'success' && countdown !== null) return 'unlocked';
    if (unlockStatus?.variant === 'error' && failureCount >= 2) return 'locked';
    return 'ready';
  }, [hasUnlockCredentials, unlockStatus, countdown, failureCount]);

  const handleUnlock = async () => {
    if (!doorUnlockService.hasCredentials) {
      setUnlockStatus({ message: 'Enter your username and password before unlocking the door.', variant: 'error' });
      setShowCredentials(true);
      return;
    }

    setIsUnlocking(true);
    setUnlockStatus({ message: 'Sending unlock request…', variant: 'info' });
    setCountdown(null);

    try {
      const result = await doorUnlockService.triggerUnlock();
      if (result.success) {
        const message = 'Door unlocked. It will re-lock shortly.';
        setUnlockStatus({ message, variant: 'success' });
        setFailureCount(0);

        setCountdown(2);
        const interval = setInterval(() => {
          setCountdown((prev) => {
            if (prev === null || prev <= 1) {
              clearInterval(interval);
              setUnlockStatus({ message: 'Door re-locked. Tap unlock to open again.', variant: 'info' });
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        const fallback = result.message || 'Unlock request failed.';
        const suffix =
          ' Double-check your username/password.';
        setFailureCount((c) => c + 1);
        setUnlockStatus({ message: `${fallback}.${suffix}`, variant: 'error' });
      }
    } catch (error) {
      const fallback = error instanceof Error ? error.message : 'Failed to contact unlock service.';
      const suffix =
        ' Double-check your username/password.';
      setFailureCount((c) => c + 1);
      setUnlockStatus({ message: `${fallback}.${suffix}`, variant: 'error' });
      setCountdown(null);
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      doorUnlockService.updateCredentials({ username, password });
      setConfigStatus({ message: 'Credentials saved for this browser.', variant: 'success' });
      setPassword('');
      setUnlockStatus(generateUnlockStatus(doorUnlockService.currentConfig));
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearPassword = () => {
    doorUnlockService.clearStoredPassword();
    setConfigStatus({ message: 'Stored password removed from this device.', variant: 'info' });
    setUnlockStatus(generateUnlockStatus(doorUnlockService.currentConfig));
  };

  const handleClearCredentials = () => {
    doorUnlockService.clearStoredCredentials();
    setUsername('');
    setPassword('');
    setConfigStatus({ message: 'Credentials cleared. Enter a new username and password.', variant: 'warning' });
    setUnlockStatus(generateUnlockStatus(doorUnlockService.currentConfig));
    setShowCredentials(true);
  };

  return (
    <Sheet open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <SheetContent
        side="bottom"
        className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-t-[24px] border-border/70 bg-white p-0 shadow-[0_-28px_90px_rgba(15,23,42,0.2)]"
      >
        {/* Handle */}
        <div className="flex justify-center pt-2" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        <SheetHeader className="gap-1 px-5 pb-2 pt-3">
          <SheetTitle className="text-[20px] font-bold leading-tight tracking-[-0.3px] text-foreground">
            Door Access
          </SheetTitle>
          <p className="text-[13px] text-muted-foreground">Community Hub · 123 Example St</p>
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-4 pt-2">
          {/* Big circular state button */}
          <div className="flex flex-col items-center py-3">
            <button
              type="button"
              onClick={handleUnlock}
              disabled={!hasUnlockCredentials || isUnlocking || uiState === 'locked'}
              aria-label="Unlock door"
              className="flex h-[160px] w-[160px] items-center justify-center rounded-full text-white transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70"
              style={{
                background:
                  uiState === 'unlocked'
                    ? '#E9FFF4'
                    : uiState === 'locked'
                      ? 'radial-gradient(circle at 30% 30%, #F8D0D0, #E11D48)'
                      : uiState === 'nocreds'
                        ? 'radial-gradient(circle at 30% 30%, #F0F2F6, #9498A8)'
                        : 'radial-gradient(circle at 30% 30%, var(--indigo-soft), #4F46FF)',
                color: uiState === 'unlocked' ? '#0F7A4F' : '#fff',
                boxShadow:
                  uiState === 'ready'
                    ? '0 20px 60px rgba(79,70,255,0.4)'
                    : uiState === 'locked'
                      ? '0 20px 60px rgba(225,29,72,0.35)'
                      : uiState === 'unlocked'
                        ? 'inset 0 0 0 2px #A7F0CA'
                        : '0 8px 24px rgba(14,16,32,0.12)',
              }}
            >
              <span style={{ fontSize: 70, lineHeight: 1 }} aria-hidden>
                {uiState === 'unlocked' ? '✅' : uiState === 'locked' ? '⏱' : '🔓'}
              </span>
            </button>

            <div
              className="mt-5 text-[22px] font-bold leading-tight tracking-[-0.4px]"
              style={{
                color:
                  uiState === 'unlocked'
                    ? '#0F7A4F'
                    : uiState === 'locked'
                      ? '#E11D48'
                      : 'var(--foreground)',
              }}
            >
              {uiState === 'unlocked'
                ? 'Door is open'
                : uiState === 'locked'
                  ? 'Try again later'
                  : uiState === 'nocreds'
                    ? 'Save credentials below'
                    : isUnlocking
                      ? 'Unlocking…'
                      : 'Tap to unlock'}
            </div>

            <div className="mt-1.5 max-w-[280px] text-center text-[13px] text-muted-foreground">
              {uiState === 'unlocked'
                ? countdown !== null
                  ? `Re-locks in ${countdown} second${countdown !== 1 ? 's' : ''}. Please close it behind you.`
                  : 'Please close it behind you.'
                : uiState === 'locked'
                  ? 'Multiple failed attempts. Double-check your credentials.'
                  : uiState === 'nocreds'
                    ? 'Enter your volunteer username and password to enable the unlock button.'
                    : 'Unlock works for about 2 seconds. Your unlock will be logged.'}
            </div>

            {unlockStatus && unlockStatus.variant === 'error' && uiState !== 'locked' ? (
              <div className="mt-3 w-full rounded-xl border border-[#F8B8C5] bg-[#FFE4E9] px-3 py-2 text-center text-[12px] font-medium text-[#E11D48]">
                <Linkified text={unlockStatus.message} />
              </div>
            ) : null}
          </div>

          {/* Credentials card — design flourish as "saved" display */}
          <div className="rounded-[14px] bg-slate-50 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Shift Credentials
                </div>
                {config.username ? (
                  <>
                    <div
                      className="mt-1.5 truncate text-foreground"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 20,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                      }}
                    >
                      {config.username}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {hasStoredPassword ? 'Password saved to this device' : 'Password not saved'}
                    </div>
                  </>
                ) : (
                  <div className="mt-1.5 text-[14px] font-semibold text-foreground">
                    No credentials saved
                  </div>
                )}
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Kitchen lockbox · Wi-Fi: Volunteers
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-lg px-3 text-[12px] font-semibold"
                onClick={() => setShowCredentials((v) => !v)}
              >
                {showCredentials ? 'Hide' : 'Edit'}
              </Button>
            </div>
          </div>

          {/* Credentials form — collapsible */}
          {showCredentials ? (
            <form className="flex flex-col gap-2.5 rounded-[14px] border border-slate-200 bg-white p-3.5" onSubmit={handleSave}>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground" htmlFor="door-username">
                  Username
                </label>
                <Input
                  id="door-username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="volunteer"
                  autoComplete="username"
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground" htmlFor="door-password">
                  Password
                </label>
                <Input
                  id="door-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={hasStoredPassword ? 'Password stored locally' : 'Enter password'}
                  autoComplete="current-password"
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="mt-1 flex flex-wrap gap-2">
                <Button type="submit" size="sm" className="h-10 rounded-xl px-4" disabled={isSaving}>
                  {isSaving ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-xl px-4"
                  onClick={handleClearPassword}
                  disabled={!hasStoredPassword}
                >
                  Clear password
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  className="h-10 rounded-xl px-4"
                  onClick={handleClearCredentials}
                >
                  Forget
                </Button>
              </div>

              {configStatus ? (
                <div className="mt-1 text-[12px] font-medium text-muted-foreground">
                  <Linkified text={configStatus.message} />
                </div>
              ) : null}
            </form>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-white px-5 py-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-12 w-full rounded-xl text-[15px] font-semibold"
          >
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const Linkified: React.FC<{ text: string }> = ({ text }) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return (
    <>
      {parts.map((part, idx) =>
        urlRegex.test(part) ? (
          <a key={idx} href={part} target="_blank" rel="noreferrer" className="underline">
            {part}
          </a>
        ) : (
          <span key={idx}>{part}</span>
        )
      )}
    </>
  );
};

const generateUnlockStatus = (config: DoorUnlockConfig): Status => {
  if (!(config.username && config.password)) {
    return { message: 'Unlock button disabled until you enter credentials.', variant: 'warning' };
  }

  const summary = `Ready to unlock as ${config.username}`;
  return { message: summary, variant: 'info' };
};
