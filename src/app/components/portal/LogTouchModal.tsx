import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { usePortalStore } from '@/services/portalState';
import type {
  OutreachChannel,
  OutreachDirection,
  ContactType,
  NewOutreachLogEntry,
} from '@/types/portal';

// ─── Props ────────────────────────────────────────────────────────────────────

interface LogTouchModalProps {
  open: boolean;
  onClose: () => void;
  prefill?: {
    contact_name?: string;
    contact_type?: ContactType;
  };
  /** Optional override — if omitted, falls back to usePortalStore().logTouch */
  onLogTouch?: (entry: NewOutreachLogEntry) => Promise<void>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHANNELS: { value: OutreachChannel; label: string }[] = [
  { value: 'IG', label: 'Instagram DM' },
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'in-person', label: 'In-person' },
  { value: 'voice-memo', label: 'Voice memo' },
  { value: 'third-party', label: 'Third-party' },
  { value: 'phone', label: 'Phone call' },
];

const CONTACT_TYPES: { value: ContactType; label: string }[] = [
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'active', label: 'Active' },
  { value: 'partner_org', label: 'Partner org' },
  { value: 'lapsed', label: 'Lapsed' },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

// ─── Shared input class ───────────────────────────────────────────────────────

const INPUT_CLS =
  'w-full bg-paperDeep border border-ink/20 px-2 py-1.5 font-body text-[14px] text-ink focus:outline-none focus:ring-1 focus:ring-ink placeholder:text-ink/35';

// ─── Component ────────────────────────────────────────────────────────────────

const LogTouchModal: React.FC<LogTouchModalProps> = ({ open, onClose, prefill, onLogTouch }) => {
  const storeLogTouch = usePortalStore((s) => s.logTouch);
  const logTouch = onLogTouch ?? storeLogTouch;

  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const [form, setForm] = useState<{
    contact_name: string;
    contact_type: ContactType;
    touch_date: string;
    channel: OutreachChannel;
    direction: OutreachDirection;
    summary: string;
    next_touch_date: string;
    next_touch_action: string;
  }>({
    contact_name: '',
    contact_type: 'pipeline',
    touch_date: todayStr(),
    channel: 'IG',
    direction: 'outbound',
    summary: '',
    next_touch_date: '',
    next_touch_action: '',
  });

  // Reset + apply prefill when modal opens
  useEffect(() => {
    if (open) {
      setConfirmed(false);
      setForm((prev) => ({
        ...prev,
        contact_name: prefill?.contact_name ?? '',
        contact_type: prefill?.contact_type ?? 'pipeline',
        touch_date: todayStr(),
        summary: '',
        next_touch_date: '',
        next_touch_action: '',
      }));
    }
  }, [open, prefill?.contact_name, prefill?.contact_type]);

  const setField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.summary.trim()) return;

    const entry: NewOutreachLogEntry = {
      contact_name: form.contact_name.trim(),
      contact_type: form.contact_type,
      touch_date: form.touch_date,
      channel: form.channel,
      direction: form.direction,
      summary: form.summary.trim(),
      next_touch_date: form.next_touch_date || null,
      next_touch_action: form.next_touch_action.trim(),
    };

    setSubmitting(true);
    try {
      await logTouch(entry);
      setConfirmed(true);
      toast.success('Touch logged ✓');
      // Brief pause so user sees confirmation, then close
      setTimeout(() => {
        onClose();
      }, 800);
    } catch {
      toast.error('Failed to log touch — check console');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink/30"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-paper border border-ink/25 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal header ─────────────────────────────────────────────────── */}
        <div className="px-5 pt-5 pb-4 border-b border-ink/12">
          <p className="font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/45 mb-0.5">
            Community
          </p>
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-[18px] text-ink">Log touch</h2>
            <button
              onClick={onClose}
              className="text-ink/40 hover:text-ink text-xl leading-none transition-colors"
              aria-label="Close"
            >
              &times;
            </button>
          </div>
        </div>

        {/* ── Inline confirmation ───────────────────────────────────────────── */}
        {confirmed && (
          <div className="px-5 py-3 bg-moss/10 border-b border-ink/10 font-mono text-[12px] text-moss italic">
            Logged. Closing…
          </div>
        )}

        {/* ── Form ─────────────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 overflow-y-auto max-h-[80vh]">
          {/* Contact name */}
          <div>
            <label className="block font-body text-[12px] font-semibold uppercase tracking-wide text-ink/70 mb-1">
              Contact name <span className="text-brick">*</span>
            </label>
            <input
              type="text"
              required
              value={form.contact_name}
              onChange={(e) => setField('contact_name', e.target.value)}
              placeholder="Name"
              className={INPUT_CLS}
            />
          </div>

          {/* Contact type + touch date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-body text-[12px] font-semibold uppercase tracking-wide text-ink/70 mb-1">
                Type
              </label>
              <select
                value={form.contact_type}
                onChange={(e) => setField('contact_type', e.target.value)}
                className={cn(INPUT_CLS, 'bg-paperDeep')}
              >
                {CONTACT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-body text-[12px] font-semibold uppercase tracking-wide text-ink/70 mb-1">
                Touch date
              </label>
              <input
                type="date"
                value={form.touch_date}
                onChange={(e) => setField('touch_date', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Channel + direction */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-body text-[12px] font-semibold uppercase tracking-wide text-ink/70 mb-1">
                Channel
              </label>
              <select
                value={form.channel}
                onChange={(e) => setField('channel', e.target.value)}
                className={cn(INPUT_CLS, 'bg-paperDeep')}
              >
                {CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-body text-[12px] font-semibold uppercase tracking-wide text-ink/70 mb-1">
                Direction
              </label>
              <div className="flex gap-1.5 mt-0.5">
                {(['outbound', 'inbound'] as OutreachDirection[]).map((dir) => (
                  <label
                    key={dir}
                    className={cn(
                      'flex-1 flex items-center justify-center py-1.5 border text-[12px] font-semibold cursor-pointer transition-colors font-body',
                      form.direction === dir
                        ? 'bg-ink text-paper border-ink'
                        : 'bg-paperDeep border-ink/20 text-ink/60 hover:text-ink',
                    )}
                  >
                    <input
                      type="radio"
                      name="direction"
                      value={dir}
                      checked={form.direction === dir}
                      onChange={() => setField('direction', dir)}
                      className="sr-only"
                    />
                    {dir === 'outbound' ? 'Out' : 'In'}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Summary */}
          <div>
            <label className="block font-body text-[12px] font-semibold uppercase tracking-wide text-ink/70 mb-1">
              Summary <span className="text-brick">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={form.summary}
              onChange={(e) => setField('summary', e.target.value)}
              placeholder="What happened? Key context?"
              className={cn(INPUT_CLS, 'resize-none')}
            />
          </div>

          {/* Next touch date + action */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-body text-[12px] font-semibold uppercase tracking-wide text-ink/70 mb-1">
                Next date{' '}
                <span className="normal-case tracking-normal font-normal text-ink/40">
                  (opt)
                </span>
              </label>
              <input
                type="date"
                value={form.next_touch_date}
                onChange={(e) => setField('next_touch_date', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="block font-body text-[12px] font-semibold uppercase tracking-wide text-ink/70 mb-1">
                Next action{' '}
                <span className="normal-case tracking-normal font-normal text-ink/40">
                  (opt)
                </span>
              </label>
              <input
                type="text"
                value={form.next_touch_action}
                onChange={(e) => setField('next_touch_action', e.target.value)}
                placeholder="e.g. Follow up re: Saturday"
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1 pb-2">
            <button
              type="submit"
              disabled={submitting || confirmed}
              className="w-full py-2 bg-ink text-paper font-body font-semibold text-[14px] transition-opacity disabled:opacity-50"
            >
              {submitting ? 'Logging…' : 'LOG TOUCH'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-1.5 font-body text-[13px] text-ink/55 hover:text-ink transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LogTouchModal;
