import React, { useEffect, useMemo, useState } from 'react';
import { X, MessageCircle, Mail, Instagram, Phone, User, Eye, EyeOff, Calendar } from 'lucide-react';
import { usePortalStore } from '@/services/portalState';
import {
  shiftColor,
  cookHouseColor,
  statusColor,
  urgencyForDays,
} from '@/services/portalColors';
import type {
  PipelineContact,
  Volunteer,
  OutreachLogEntry,
  OutreachChannel,
} from '@/types/portal';

/**
 * PersonDrawer — slides in from the right when usePortalStore.selectedPerson
 * is set. Shows: header (name + crew/status), contact (click-to-reveal),
 * touch history (timeline), quick actions. Closing via X, ESC, or backdrop.
 */
const PersonDrawer: React.FC = () => {
  const selectedPerson = usePortalStore((s) => s.selectedPerson);
  const closePerson = usePortalStore((s) => s.closePerson);
  const openLogTouchModal = usePortalStore((s) => s.openLogTouchModal);
  const roster = usePortalStore((s) => s.roster);
  const outreachLog = usePortalStore((s) => s.outreachLog);

  const [contactRevealed, setContactRevealed] = useState(false);

  // Reset revealed state when person changes
  useEffect(() => {
    setContactRevealed(false);
  }, [selectedPerson?.name]);

  // ESC to close
  useEffect(() => {
    if (!selectedPerson) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePerson();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedPerson, closePerson]);

  // Lookup person data
  const resolved = useMemo(() => resolvePerson(selectedPerson, roster), [selectedPerson, roster]);

  // Touch history for this contact
  const touches = useMemo(() => {
    if (!selectedPerson) return [];
    return [...outreachLog]
      .filter((e) => e.contact_name === selectedPerson.name)
      .sort((a, b) => (a.touch_date < b.touch_date ? 1 : -1));
  }, [outreachLog, selectedPerson]);

  if (!selectedPerson) return null;

  const today = new Date().toISOString().slice(0, 10);

  const headerColor = resolved
    ? resolved.kind === 'pipeline'
      ? statusColor(resolved.contact.status)
      : resolved.kind === 'active-recurring'
      ? shiftColor(resolved.volunteer.shifts[0] ?? '')
      : resolved.kind === 'cook'
      ? cookHouseColor(resolved.house)
      : { bar: '#1a1410', text: '#1a1410', tint: 'transparent', label: 'VOLUNTEER' }
    : { bar: '#86807a', text: '#1a1410', tint: 'transparent', label: 'UNKNOWN' };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/30 z-40"
        onClick={closePerson}
        aria-hidden
      />

      {/* Drawer panel */}
      <aside
        className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[440px] bg-paper border-l-4 flex flex-col shadow-2xl"
        style={{ borderLeftColor: headerColor.bar }}
        role="dialog"
        aria-label={`${selectedPerson.name} details`}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-ink/15 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-body text-[10px] tracking-[0.18em] uppercase text-ink/45 mb-1">
              {headerColor.label} · {selectedPerson.contact_type.replace('_', ' ')}
            </div>
            <h2 className="font-display font-bold text-[22px] text-ink leading-tight tracking-tight truncate">
              {cleanName(selectedPerson.name)}
            </h2>
            {resolved?.kind === 'pipeline' && (
              <div className="mt-2 inline-block">
                <span
                  className="font-body uppercase text-[10px] tracking-[0.10em] leading-tight px-1.5 py-[2px] border"
                  style={{
                    background: statusColor(resolved.contact.status).bg,
                    color: statusColor(resolved.contact.status).fg,
                    borderColor: 'rgba(26,20,16,0.18)',
                  }}
                >
                  {statusColor(resolved.contact.status).label}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={closePerson}
            className="text-ink/50 hover:text-ink p-1 -mr-1 -mt-1"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Pronouns + days/role */}
          {resolved && (
            <section>
              <DetailGrid>
                {resolved.kind === 'pipeline' ? (
                  <>
                    <DetailRow label="Pronouns" value={resolved.contact.pronouns} />
                    <DetailRow label="Source" value={resolved.contact.source} />
                    <DetailRow label="Interested in" value={resolved.contact.days_role} />
                    <DetailRow label="Status" value={resolved.contact.status} />
                  </>
                ) : resolved.kind === 'active-recurring' ? (
                  <>
                    <DetailRow label="Pronouns" value={resolved.volunteer.pronouns} />
                    <DetailRow label="Tenure" value={resolved.volunteer.tenure} />
                    <DetailRow label="Shifts" value={resolved.volunteer.shifts.map(s => s.toUpperCase()).join(' · ')} />
                    <DetailRow label="Access" value={resolved.volunteer.access} />
                  </>
                ) : resolved.kind === 'cook' ? (
                  <>
                    <DetailRow label="Pronouns" value={resolved.volunteer.pronouns} />
                    <DetailRow label="House" value={resolved.house.toUpperCase()} />
                    <DetailRow label="Tenure" value={resolved.volunteer.tenure} />
                  </>
                ) : resolved.kind === 'distro-lines' ? (
                  <>
                    <DetailRow label="Pronouns" value={resolved.volunteer.pronouns} />
                    <DetailRow label="Group chat" value={resolved.chat} />
                    <DetailRow label="Tenure" value={resolved.volunteer.tenure} />
                  </>
                ) : null}
              </DetailGrid>
            </section>
          )}

          {/* Contact info — click to reveal */}
          {resolved && (
            <section>
              <SectionLabel>Contact</SectionLabel>
              {(() => {
                const raw =
                  resolved.kind === 'pipeline'
                    ? resolved.contact.contact
                    : resolved.volunteer.contact;
                if (!raw) {
                  return (
                    <p className="font-mono text-[12px] text-ink/55 italic">
                      No contact info in tracker.md — check volunteer-contacts.md
                    </p>
                  );
                }
                return (
                  <div>
                    {!contactRevealed ? (
                      <button
                        onClick={() => setContactRevealed(true)}
                        className="inline-flex items-center gap-1.5 font-mono text-[12px] text-ink/55 hover:text-ink underline decoration-dotted underline-offset-2"
                      >
                        <EyeOff size={12} />
                        Click to reveal contact info (hidden by default)
                      </button>
                    ) : (
                      <div className="space-y-1">
                        <ContactBlock raw={raw} />
                        <button
                          onClick={() => setContactRevealed(false)}
                          className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink/45 hover:text-ink"
                        >
                          <Eye size={11} />
                          hide
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </section>
          )}

          {/* Notes from tracker.md */}
          {resolved && (
            <section>
              <SectionLabel>Notes (tracker.md)</SectionLabel>
              <NotesBlock
                notes={
                  resolved.kind === 'pipeline'
                    ? resolved.contact.notes
                    : resolved.volunteer.notes
                }
              />
            </section>
          )}

          {/* Touch history */}
          <section>
            <SectionLabel>
              Touch history{' '}
              <span className="font-mono text-[10px] text-ink/45 normal-case tracking-wide">
                {touches.length} {touches.length === 1 ? 'entry' : 'entries'}
              </span>
            </SectionLabel>
            {touches.length === 0 ? (
              <p className="font-mono text-[12px] text-ink/55 italic">
                No logged touches yet. Use "Log touch" below to add one.
              </p>
            ) : (
              <ul className="space-y-3">
                {touches.map((t) => (
                  <TouchEntry key={t.id} entry={t} today={today} />
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Footer — quick actions */}
        <div className="border-t border-ink/15 px-4 py-3 flex items-center gap-2">
          <button
            onClick={() => {
              const channel: OutreachChannel =
                guessPreferredChannel(resolved) ?? 'text';
              openLogTouchModal({
                contact_name: selectedPerson.name,
                contact_type: selectedPerson.contact_type,
                channel,
                direction: 'outbound',
                touch_date: today,
              });
            }}
            className="flex-1 bg-ink text-paper font-body font-semibold text-[13px] py-2 hover:bg-ink/85 transition-colors"
          >
            Log touch
          </button>
          {resolved?.kind === 'pipeline' && (
            <button
              className="bg-moss text-paper font-body font-semibold text-[12px] py-2 px-3 hover:opacity-90"
              onClick={() => alert('Convert-to-active flow lands in Phase 3 — for now, edit tracker.md directly to move the row to the appropriate active section.')}
              title="Convert pipeline contact to active volunteer"
            >
              → Active
            </button>
          )}
        </div>
      </aside>
    </>
  );
};

export default PersonDrawer;

// ─── Helpers ─────────────────────────────────────────────────────────────────

type ResolvedPerson =
  | { kind: 'pipeline'; contact: PipelineContact }
  | { kind: 'active-recurring'; volunteer: Volunteer }
  | { kind: 'cook'; volunteer: Volunteer; house: string }
  | { kind: 'distro-lines'; volunteer: Volunteer; chat: string }
  | null;

function resolvePerson(
  ref: { name: string; contact_type: string } | null,
  roster: ReturnType<typeof usePortalStore.getState>['roster'],
): ResolvedPerson {
  if (!ref || !roster) return null;

  if (ref.contact_type === 'pipeline') {
    const contact = roster.pipeline.find((p) => p.name === ref.name);
    if (contact) return { kind: 'pipeline', contact };
  }

  const recurring = roster.active_recurring.find((v) => v.name === ref.name);
  if (recurring) return { kind: 'active-recurring', volunteer: recurring };

  for (const [house, volunteers] of Object.entries(roster.active_cooks)) {
    const found = volunteers.find((v) => v.name === ref.name);
    if (found) return { kind: 'cook', volunteer: found, house };
  }

  for (const [chat, volunteers] of Object.entries(roster.active_distro_by_chat)) {
    const found = volunteers.find((v) => v.name === ref.name);
    if (found) return { kind: 'distro-lines', volunteer: found, chat };
  }

  return null;
}

function cleanName(name: string): string {
  // Strip parenthetical suffixes like "(last name?)" for display
  return name.replace(/\s*\([^)]*\)\s*$/, '').replace(/\*\*/g, '').trim();
}

function guessPreferredChannel(resolved: ResolvedPerson): OutreachChannel | null {
  if (!resolved) return null;
  const raw = resolved.kind === 'pipeline' ? resolved.contact.contact : resolved.volunteer.contact;
  if (!raw) return null;
  if (raw.includes('@') && raw.includes('.com')) return 'email';
  if (raw.toLowerCase().includes('ig ') || raw.includes('@') && !raw.includes('.com')) return 'IG';
  return 'text';
}

// ─── Small subcomponents ─────────────────────────────────────────────────────

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="font-body text-[10px] uppercase tracking-[0.18em] text-ink/50 mb-2 flex items-baseline gap-2">
    {children}
  </h3>
);

const DetailGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5">{children}</dl>
);

const DetailRow: React.FC<{ label: string; value: string | null | undefined }> = ({
  label,
  value,
}) => (
  <>
    <dt className="font-body text-[10px] uppercase tracking-[0.12em] text-ink/45 leading-relaxed pt-[2px]">
      {label}
    </dt>
    <dd className="font-body text-[13px] text-ink/85 leading-relaxed">{value ?? '—'}</dd>
  </>
);

const ContactBlock: React.FC<{ raw: string }> = ({ raw }) => {
  // Split raw contact string like "555-0100 · alex@example.com · IG @alex"
  const parts = raw.split(/\s*·\s*/).filter(Boolean);
  return (
    <ul className="space-y-1.5">
      {parts.map((part, i) => {
        const icon = part.includes('@') && part.includes('.')
          ? <Mail size={13} />
          : part.toLowerCase().includes('ig')
          ? <Instagram size={13} />
          : <Phone size={13} />;
        // If part is a phone number, also offer iMessage deep-link
        const phoneMatch = part.match(/(\+?\d[\d\-\s.()]{7,})/);
        const igMatch = part.match(/(@\w+)/);
        return (
          <li key={i} className="flex items-center gap-2">
            <span className="text-ink/55">{icon}</span>
            <span className="font-mono text-[13px] text-ink">{part}</span>
            {phoneMatch && (
              <a
                href={`sms:${phoneMatch[1].replace(/[^\d+]/g, '')}`}
                className="ml-auto font-body text-[11px] text-purple-ink hover:underline"
              >
                Open Messages →
              </a>
            )}
            {igMatch && (
              <a
                href={`https://instagram.com/${igMatch[1].slice(1)}`}
                target="_blank"
                rel="noreferrer"
                className="ml-auto font-body text-[11px] text-purple-ink hover:underline"
              >
                Open IG →
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
};

const NotesBlock: React.FC<{ notes: string }> = ({ notes }) => {
  if (!notes) {
    return <p className="font-mono text-[12px] text-ink/55 italic">No notes.</p>;
  }
  // Naive markdown bold rendering — preserves emphasis from tracker.md
  const parts = notes.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p className="font-body text-[13px] text-ink/80 leading-relaxed">
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-semibold text-ink">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </p>
  );
};

const TouchEntry: React.FC<{ entry: OutreachLogEntry; today: string }> = ({
  entry,
  today,
}) => {
  const isInbound = entry.direction === 'inbound';
  const daysAgo = Math.round(
    (new Date(today).getTime() - new Date(entry.touch_date).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  const nextUrg = entry.next_touch_date
    ? urgencyForDays(
        Math.round(
          (new Date(today).getTime() -
            new Date(entry.next_touch_date).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  const channelIcon = channelToIcon(entry.channel);

  return (
    <li className="border-l-2 border-ink/15 pl-3 py-1 relative">
      <div className="absolute left-[-5px] top-3 w-2 h-2 rounded-full bg-paper border border-ink/40" />
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-mono text-[11px] text-ink">{formatDate(entry.touch_date)}</span>
        <span className="font-mono text-[10px] text-ink/45">
          {daysAgo === 0 ? 'today' : daysAgo === 1 ? '1d ago' : `${daysAgo}d ago`}
        </span>
        <span className="font-body text-[10px] uppercase tracking-wide text-ink/55 inline-flex items-center gap-1 ml-auto">
          {channelIcon}
          {entry.channel}
        </span>
        <span
          className={`font-body text-[9px] uppercase tracking-wide px-1.5 py-[1px] border ${
            isInbound
              ? 'border-moss/40 text-mossDeep bg-moss/10'
              : 'border-ink/20 text-ink/60'
          }`}
        >
          {isInbound ? '← in' : 'out →'}
        </span>
      </div>
      <p className="font-body text-[13px] text-ink mt-1 leading-snug">{entry.summary}</p>
      {entry.next_touch_date && (
        <div className="mt-2 text-[11px] flex items-center gap-1.5 font-mono">
          <Calendar size={11} className="text-ink/40" />
          <span className="text-ink/55">next:</span>
          <span style={{ color: nextUrg?.text ?? '#1a1410' }}>
            {formatDate(entry.next_touch_date)} ({nextUrg?.badge ?? '—'})
          </span>
          {entry.next_touch_action && (
            <span className="text-ink/55 italic">— {entry.next_touch_action}</span>
          )}
        </div>
      )}
    </li>
  );
};

function channelToIcon(ch: OutreachChannel): React.ReactNode {
  switch (ch) {
    case 'IG':
      return <Instagram size={11} />;
    case 'email':
      return <Mail size={11} />;
    case 'in-person':
      return <User size={11} />;
    case 'phone':
      return <Phone size={11} />;
    case 'text':
      return <MessageCircle size={11} />;
    default:
      return null;
  }
}

function formatDate(yyyymmdd: string): string {
  const d = new Date(yyyymmdd);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
