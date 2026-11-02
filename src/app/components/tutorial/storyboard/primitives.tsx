import React from 'react';

import { DS } from './tokens';

/**
 * StoryboardContext — when a mockup screen is rendered inside `PhasePreview`,
 * the host wraps it with `embedded={true}` so the inner `CoachMark` and
 * `ScreenFrame` step label suppress themselves. The mockup keeps all its
 * structural chrome (header, rows, tab bar) but stops competing with the
 * host's own coach card. Standalone usage (the storyboard canvas) leaves the
 * defaults untouched.
 */
export type StoryboardContextValue = { embedded: boolean };
export const StoryboardContext = React.createContext<StoryboardContextValue>({ embedded: false });

// ─────────────────────────────────────────────────────────────
// Icons (inline SVGs — match the design source 1:1)
// ─────────────────────────────────────────────────────────────
export const IconRefresh = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);

export const IconUnlock = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
);

export const IconMore = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
    <circle cx="12" cy="5" r="0.6" fill="currentColor" />
    <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    <circle cx="12" cy="19" r="0.6" fill="currentColor" />
  </svg>
);

const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <path d="M22 4 12 14.01l-3-3" />
  </svg>
);

const IconBox = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const IconTruck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13" />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const IconArchive = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="21 8 21 21 3 21 3 8" />
    <rect x="1" y="3" width="22" height="5" />
    <line x1="10" y1="12" x2="14" y2="12" />
  </svg>
);

const IconInfo = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

// ─────────────────────────────────────────────────────────────
// App chrome — header + tab bar
// ─────────────────────────────────────────────────────────────
type IconBtnProps = { children: React.ReactNode; highlight?: boolean };
const IconBtn: React.FC<IconBtnProps> = ({ children, highlight }) => (
  <div style={{
    width: 28, height: 28, borderRadius: 7,
    border: `1px solid ${highlight ? DS.indigo : DS.slate200}`,
    background: highlight ? DS.indigoSoft : '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: highlight ? DS.indigo : DS.slate700,
    boxShadow: highlight ? `0 0 0 4px ${DS.indigoSoft}80` : 'none',
  }}>{children}</div>
);

type TrackerHeaderProps = {
  status?: { label: string; color: string; breathe?: boolean };
  demo?: boolean;
  highlightMore?: boolean;
  highlightUnlock?: boolean;
};
export const TrackerHeader: React.FC<TrackerHeaderProps> = ({
  status = { label: 'Live', color: DS.greenInk, breathe: true },
  demo = false,
  highlightMore = false,
  highlightUnlock = false,
}) => (
  <div style={{
    background: '#fff',
    boxShadow: '0 8px 18px rgba(15,23,42,.06)',
    padding: '8px 14px 10px',
    borderBottom: '1px solid rgba(0,0,0,0.02)',
    fontFamily: DS.font,
    flexShrink: 0,
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 22 }}>🍜</span>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: DS.slate900, letterSpacing: -0.1 }}>Food Tracker</span>
            {demo && (
              <span style={{
                background: '#F3E8FF', color: '#7E22CE',
                fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
                padding: '2px 5px', borderRadius: 999, letterSpacing: 0.4,
              }}>Demo</span>
            )}
          </div>
          <div style={{ fontSize: 9, fontWeight: 600, color: DS.slate500, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 1 }}>Community · Fri May 9</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 8px', borderRadius: 999,
          border: `1px solid ${DS.slate200}`,
          fontSize: 9, fontWeight: 700, color: DS.slate600,
          background: '#fff',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: 3, background: status.color,
            animation: status.breathe ? 'pulseBreathe 2.4s ease-in-out infinite' : 'none',
          }} />
          {status.label}
        </span>
        <IconBtn><IconRefresh /></IconBtn>
        <IconBtn highlight={highlightUnlock}><IconUnlock /></IconBtn>
        <IconBtn highlight={highlightMore}><IconMore /></IconBtn>
      </div>
    </div>
  </div>
);

type TabCounts = Partial<Record<'confirm' | 'storage' | 'pickup' | 'inventory', string>>;
type TrackerTabBarProps = { active?: 'confirm' | 'storage' | 'pickup' | 'inventory'; counts?: TabCounts };
export const TrackerTabBar: React.FC<TrackerTabBarProps> = ({ active = 'confirm', counts = {} }) => {
  const tabs = [
    { id: 'confirm' as const, label: 'Confirm', icon: <IconCheck />, count: counts.confirm ?? '0/8' },
    { id: 'storage' as const, label: 'Storage', icon: <IconBox />, count: counts.storage ?? '0/12' },
    { id: 'pickup' as const, label: 'Pickup', icon: <IconTruck />, count: counts.pickup ?? '0/9' },
    { id: 'inventory' as const, label: 'Inventory', icon: <IconArchive />, count: counts.inventory ?? '0/24' },
  ];
  return (
    <div style={{
      borderTop: `1px solid ${DS.slate200}`,
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(16px) saturate(180%)',
      WebkitBackdropFilter: 'blur(16px) saturate(180%)',
      padding: '6px 8px 14px',
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4,
      fontFamily: DS.font,
      flexShrink: 0,
    }}>
      {tabs.map((t) => {
        const isActive = active === t.id;
        const [done, total] = (t.count || '0/0').split('/').map(Number);
        const remaining = Math.max(total - done, 0);
        return (
          <div key={t.id} style={{
            position: 'relative',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 1, padding: '6px 0', minHeight: 56,
            color: isActive ? DS.indigo : DS.slate600,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9,
              background: isActive ? DS.indigoSoft : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{t.icon}</div>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.1 }}>{t.label}</span>
            {remaining > 0 && total > 0 && done < total && (
              <span style={{
                position: 'absolute', top: 4, right: '50%', marginRight: -22,
                background: DS.saffron, color: DS.saffronInk,
                borderRadius: 999, padding: '1px 5px', minWidth: 16,
                fontSize: 9, fontWeight: 800, lineHeight: '12px',
                textAlign: 'center',
              }}>{remaining}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// QuantityBadge — pill with optional original-qty strikethrough
// ─────────────────────────────────────────────────────────────
type QuantityBadgeProps = {
  qty: string | number;
  original?: string | number | null;
  unit?: string;
  tone?: 'lavender' | 'mint' | 'peach';
};
export const QuantityBadge: React.FC<QuantityBadgeProps> = ({ qty, original, tone = 'lavender' }) => {
  const tones = {
    lavender: { bg: DS.lavenderBg, fg: DS.lavenderInk },
    mint: { bg: DS.mintBg, fg: DS.mintInk },
    peach: { bg: DS.peachBadgeBg, fg: DS.peachBadgeInk },
  }[tone];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 9px', borderRadius: 999,
      background: tones.bg, color: tones.fg,
      fontFamily: DS.mono, fontSize: 12, fontWeight: 700,
      letterSpacing: '-0.02em',
      whiteSpace: 'nowrap',
    }}>
      {original != null && (
        <span style={{ opacity: 0.6, textDecoration: 'line-through', marginRight: 2 }}>{original}</span>
      )}
      <span>{qty}</span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Confirm components — match ConfirmationView.tsx
// ─────────────────────────────────────────────────────────────
export type ConfirmRowState = 'pending' | 'staged-low' | 'staged-out' | 'expected' | 'low' | 'out';

type ConfirmRowProps = {
  emoji: string;
  name: string;
  qty: number;
  unit?: string;
  state?: ConfirmRowState;
  receivedQty?: number;
  highlight?: boolean;
  teammateBorder?: boolean;
  showInfo?: boolean;
};

export const ConfirmRow: React.FC<ConfirmRowProps> = ({
  emoji, name, qty, unit = 'cases',
  state = 'pending',
  receivedQty,
  highlight,
  teammateBorder,
  showInfo = true,
}) => {
  let chip: { bg: string; border: string; fg: string; icon: string; label: string } | null = null;
  let borderColor: string = DS.slate200;
  let opacity = 1;
  let badgeQty: number = qty;
  let badgeOriginal: number | null = null;
  let badgeTone: 'lavender' | 'mint' | 'peach' = 'lavender';

  if (state === 'staged-low') {
    chip = { bg: DS.peachSoft, border: DS.peachBorder, fg: DS.peachInk, icon: '⊙', label: 'Flagged ran low — tap again for ran out' };
    borderColor = DS.peachBorder;
    badgeQty = receivedQty ?? qty; badgeOriginal = qty; badgeTone = 'peach';
  } else if (state === 'staged-out') {
    chip = { bg: DS.rougeSoft, border: DS.rougeBorder, fg: DS.rouge, icon: '×', label: 'Flagged ran out — tap to clear' };
    borderColor = DS.rougeBorder;
    badgeQty = 0; badgeOriginal = qty; badgeTone = 'peach';
  } else if (state === 'expected') {
    chip = { bg: DS.greenSoft, border: DS.greenBorder, fg: DS.greenInk, icon: '✓', label: 'Confirmed' };
    opacity = 0.6;
    badgeTone = 'mint';
  } else if (state === 'low') {
    chip = { bg: DS.peachSoft, border: DS.peachBorder, fg: DS.peachInk, icon: '⊙', label: `Ran low · rec'd ${receivedQty ?? '?'}` };
    badgeQty = receivedQty ?? qty; badgeOriginal = qty; badgeTone = 'peach';
  } else if (state === 'out') {
    chip = { bg: DS.rougeSoft, border: DS.rougeBorder, fg: DS.rouge, icon: '×', label: 'Ran out' };
    badgeQty = 0; badgeOriginal = qty; badgeTone = 'peach';
  }

  const inner = (
    <div style={{
      background: '#fff',
      borderRadius: 18,
      border: `1px solid ${borderColor}`,
      boxShadow: highlight
        ? `0 0 0 2px ${DS.indigo}, 0 4px 16px ${DS.indigo}55`
        : '0 1px 2px rgba(14,16,32,0.06), 0 1px 1px rgba(14,16,32,0.04)',
      padding: '12px 12px 12px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      opacity,
      fontFamily: DS.font,
    }}>
      <div aria-hidden style={{ width: 36, fontSize: 26, lineHeight: 1, textAlign: 'center', flexShrink: 0 }}>
        {emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 650, color: DS.slate900, letterSpacing: -0.2, lineHeight: 1.15 }}>
          {name}
        </div>
        {chip ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '2px 7px', borderRadius: 999,
            background: chip.bg, border: `1px solid ${chip.border}`,
            color: chip.fg, fontSize: 9.5, fontWeight: 600,
            width: 'fit-content', maxWidth: '100%',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            <span aria-hidden>{chip.icon}</span>
            {chip.label}
          </span>
        ) : (
          <div style={{ fontSize: 10, color: DS.slate600, fontWeight: 500 }}>
            Expected · {qty} {unit} · tap to flag
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <QuantityBadge qty={badgeQty} original={badgeOriginal} tone={badgeTone} />
        {showInfo && state === 'pending' && (
          <div style={{
            width: 22, height: 22, borderRadius: 11,
            border: `1px solid ${DS.slate200}`, background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: DS.slate500,
          }}>
            <IconInfo />
          </div>
        )}
      </div>
    </div>
  );

  if (teammateBorder) {
    return (
      <div style={{
        position: 'relative',
        borderRadius: 18,
        padding: 2,
        background: `linear-gradient(135deg, ${DS.greenInk}, ${DS.greenBorder})`,
        boxShadow: `0 0 0 4px ${DS.greenSoft}`,
      }}>
        <div style={{ background: '#fff', borderRadius: 16 }}>{inner}</div>
      </div>
    );
  }
  return inner;
};

export const InlineStepper: React.FC<{ qty: number; expected: number }> = ({ qty, expected }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8,
    padding: 8,
    borderRadius: 12,
    border: `1px solid ${DS.peachBorder}`,
    background: DS.peachStepperBg,
    fontFamily: DS.font,
    marginTop: 4,
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: 8,
      border: `1px solid ${DS.slate200}`, background: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 18, fontWeight: 800, color: DS.slate900,
    }}>−</div>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        fontSize: 18, fontWeight: 800, color: DS.peachInk,
        fontFamily: DS.mono, letterSpacing: '-0.02em', lineHeight: 1,
      }}>{qty}</div>
      <div style={{ fontSize: 9, color: DS.slate500, marginTop: 2 }}>received · expected {expected}</div>
    </div>
    <div style={{
      width: 36, height: 36, borderRadius: 8,
      border: `1px solid ${DS.slate200}`, background: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 18, fontWeight: 800, color: DS.slate900,
    }}>+</div>
  </div>
);

export const ConfirmGroupHeader: React.FC<{ icon: string; label: string; done: number; total: number }> = ({ icon, label, done, total }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 4px 6px', fontFamily: DS.font,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{
        fontSize: 10, fontWeight: 700, color: DS.slate600,
        letterSpacing: 1.2, textTransform: 'uppercase',
      }}>{label}</span>
    </div>
    <span style={{
      fontSize: 10, fontWeight: 600, color: DS.slate400,
      fontFamily: DS.mono,
    }}>{done}/{total}</span>
  </div>
);

export const ConfirmSubhead: React.FC<{ label: string; count?: string | number }> = ({ label, count }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 4px 4px',
    fontFamily: DS.font,
  }}>
    <span style={{
      fontSize: 9.5, fontWeight: 700, color: DS.slate600,
      letterSpacing: 1.2, textTransform: 'uppercase',
    }}>{label}</span>
    {count != null && (
      <span style={{
        fontSize: 9.5, fontWeight: 600, color: DS.slate400,
      }}>{count}</span>
    )}
  </div>
);

type BulkCommitBarProps = { expected?: number; low?: number; out?: number; highlight?: boolean; label?: string };
export const BulkCommitBar: React.FC<BulkCommitBarProps> = ({ expected = 0, low = 0, out = 0, highlight = false, label }) => {
  const total = expected + low + out;
  const parts: string[] = [];
  if (expected) parts.push(`${expected} as expected`);
  if (low) parts.push(`${low} ran low`);
  if (out) parts.push(`${out} ran out`);
  const breakdown = parts.length ? parts.join(' · ') : 'Nothing pending';
  const buttonLabel = label
    ? label
    : total === 0
      ? 'All caught up'
      : (expected === total ? `Confirm all ${total} as expected` : `Confirm ${total} items`);

  return (
    <div style={{
      margin: '12px 4px 0',
      padding: 10,
      background: '#fff',
      borderRadius: 16,
      border: `1px solid ${DS.slate200}`,
      boxShadow: highlight
        ? `0 0 0 2px ${DS.indigo}, 0 8px 28px ${DS.indigo}50`
        : '0 6px 24px rgba(14,16,32,0.10)',
      fontFamily: DS.font,
    }}>
      <div style={{
        height: 38, borderRadius: 12,
        background: total > 0 ? DS.indigo : DS.slate200,
        color: total > 0 ? '#fff' : DS.slate500,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        fontSize: 13, fontWeight: 700, letterSpacing: -0.1,
        boxShadow: total > 0 ? `0 4px 12px ${DS.indigo}55` : 'none',
      }}>
        <span aria-hidden>✓</span>{buttonLabel}
      </div>
      <div style={{
        marginTop: 5, textAlign: 'center',
        fontSize: 9.5, color: DS.slate500, fontWeight: 500,
      }}>{breakdown}</div>
    </div>
  );
};

export const ConfirmProgress: React.FC<{ done: number; total: number }> = ({ done, total }) => {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div style={{ padding: '4px 4px' }}>
      <div style={{ height: 6, borderRadius: 999, background: DS.slate100, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: `linear-gradient(90deg, ${DS.indigo}, ${DS.indigoDeep})`,
          transition: 'width 240ms ease-out',
        }} />
      </div>
    </div>
  );
};

export const TeammateAttribution: React.FC<{ name: string; item: string }> = ({ name, item }) => (
  <div style={{
    marginTop: 6,
    padding: '8px 10px',
    background: DS.greenSoft,
    border: `1px dashed ${DS.greenBorder}`,
    borderRadius: 12,
    fontSize: 10.5, fontWeight: 600, color: DS.greenInk,
    display: 'flex', alignItems: 'center', gap: 6,
    fontFamily: DS.font,
  }}>
    <span aria-hidden style={{ width: 6, height: 6, borderRadius: 99, background: DS.greenInk, flexShrink: 0 }} />
    <span><b>{name}</b> confirmed {item}. You don't need to re-check.</span>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Storage components
// ─────────────────────────────────────────────────────────────
type StorageFilterChipsProps = {
  active?: 'all' | 'fridge' | 'table';
  counts?: { all: number; fridge: number; table: number };
};
export const StorageFilterChips: React.FC<StorageFilterChipsProps> = ({ active = 'all', counts = { all: 9, fridge: 5, table: 4 } }) => {
  const chips = [
    { key: 'all' as const, icon: '▦', label: `All ${counts.all}` },
    { key: 'fridge' as const, icon: '🧊', label: `Fridge ${counts.fridge}` },
    { key: 'table' as const, icon: '🟫', label: `Table ${counts.table}` },
  ];
  return (
    <div style={{ display: 'flex', gap: 8, padding: '4px 4px 8px', fontFamily: DS.font }}>
      {chips.map((c) => {
        const isActive = c.key === active;
        return (
          <div key={c.key} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 11px', borderRadius: 999,
            background: isActive ? DS.indigo : '#fff',
            color: isActive ? '#fff' : DS.slate700,
            border: `1px solid ${isActive ? DS.indigo : DS.slate200}`,
            fontSize: 11, fontWeight: 600,
          }}>
            <span aria-hidden style={{ fontSize: 12 }}>{c.icon}</span>
            {c.label}
          </div>
        );
      })}
    </div>
  );
};

type StorageRowProps = {
  emoji: string;
  name: string;
  qty: string;
  packed?: boolean;
  highlightCheckbox?: boolean;
  isLast?: boolean;
};
export const StorageRow: React.FC<StorageRowProps> = ({ emoji, name, qty, packed = false, highlightCheckbox = false, isLast = false }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px',
    minHeight: 50,
    background: packed ? DS.greenSoft : '#fff',
    borderBottom: isLast ? 'none' : `1px solid ${DS.slate100}`,
    fontFamily: DS.font,
  }}>
    <div style={{
      width: 26, height: 26, borderRadius: 7,
      border: `1.5px solid ${packed ? DS.greenInk : DS.slate300}`,
      background: packed ? DS.greenInk : '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      boxShadow: highlightCheckbox ? `0 0 0 3px ${DS.indigo}, 0 0 0 6px ${DS.indigoSoft}` : 'none',
      color: '#fff',
    }}>
      {packed && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
    </div>
    <span aria-hidden style={{ width: 24, fontSize: 18, textAlign: 'center', lineHeight: 1, flexShrink: 0 }}>{emoji}</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: 13, fontWeight: 600,
        color: packed ? DS.greenInk : DS.slate900,
        textDecoration: packed ? 'line-through' : 'none',
        opacity: packed ? 0.75 : 1,
        letterSpacing: -0.1,
      }}>{name}</div>
    </div>
    <QuantityBadge qty={qty} tone={packed ? 'mint' : 'lavender'} />
  </div>
);

type StorageCardProps = {
  icon: string;
  title: string;
  done: number;
  total: number;
  children: React.ReactNode;
  highlightAllBtn?: boolean;
};
export const StorageCard: React.FC<StorageCardProps> = ({ icon, title, done, total, children, highlightAllBtn = false }) => (
  <div style={{
    background: '#fff',
    borderRadius: 20,
    border: `1px solid ${DS.slate200}`,
    boxShadow: '0 1px 2px rgba(14,16,32,0.06), 0 1px 1px rgba(14,16,32,0.04)',
    overflow: 'hidden',
    marginBottom: 8,
    fontFamily: DS.font,
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      background: DS.slate50,
      padding: '8px 12px',
      borderBottom: `1px solid ${DS.slate100}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: DS.slate900 }}>{title}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: DS.slate500, fontFamily: DS.mono }}>{done}/{total}</span>
      </div>
      <div style={{ display: 'flex', gap: 0, flexShrink: 0 }}>
        <div style={{
          padding: '4px 8px', borderRadius: 7,
          fontSize: 10, fontWeight: 600,
          color: highlightAllBtn ? DS.greenInk : DS.slate500,
          background: highlightAllBtn ? DS.greenSoft : 'transparent',
          border: highlightAllBtn ? `1px solid ${DS.greenBorder}` : '1px solid transparent',
          boxShadow: highlightAllBtn ? `0 0 0 2px ${DS.indigo}, 0 4px 12px ${DS.indigo}40` : 'none',
        }}>✓ All</div>
        <div style={{
          padding: '4px 8px', borderRadius: 7,
          fontSize: 10, fontWeight: 600, color: DS.slate500,
        }}>Reset</div>
      </div>
    </div>
    {children}
  </div>
);

export const StorageStoredFold: React.FC<{ count: number }> = ({ count }) => (
  <div style={{
    borderTop: `1px solid ${DS.slate100}`,
    background: '#fff',
    padding: '6px 16px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    fontSize: 10.5, fontWeight: 500, color: DS.slate500,
    fontFamily: DS.font,
  }}>
    <span>{count} stored</span>
    <span style={{ fontSize: 10, color: DS.slate400 }}>Show</span>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Inventory header — Browse / Count / Reorder mode tabs
// ─────────────────────────────────────────────────────────────
export const InvHeader: React.FC<{ active?: 'browse' | 'count' | 'reorder' }> = ({ active = 'count' }) => {
  const modes: ('browse' | 'count' | 'reorder')[] = ['browse', 'count', 'reorder'];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '4px 4px 8px' }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: DS.slate500, textTransform: 'uppercase', letterSpacing: 1.5 }}>Pantry</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: DS.slate900, letterSpacing: -0.5, lineHeight: 1.1 }}>Inventory</div>
          <div style={{ fontSize: 11, color: DS.slate500, marginTop: 2 }}>
            142 items <span style={{ color: DS.slate300, margin: '0 4px' }}>·</span>
            <span style={{ color: DS.peachInk }}>8 below par</span>
          </div>
        </div>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          border: `1px solid ${DS.slate200}`, background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: DS.slate600,
        }}>
          <IconRefresh />
        </div>
      </div>
      <div style={{
        display: 'flex', padding: 3, gap: 2,
        background: DS.slate100, borderRadius: 11,
      }}>
        {modes.map((m) => {
          const isActive = m === active;
          return (
            <div key={m} style={{
              flex: 1, textAlign: 'center', padding: '7px 0',
              fontSize: 11.5, fontWeight: 700,
              color: isActive ? DS.slate900 : DS.slate500,
              background: isActive ? '#fff' : 'transparent',
              borderRadius: 9,
              boxShadow: isActive ? '0 1px 2px rgba(14,16,32,0.08)' : 'none',
              textTransform: 'capitalize',
            }}>{m}</div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Coach mark — overlay tooltip with phase pips
// ─────────────────────────────────────────────────────────────
type CoachMarkProps = {
  step: number;
  total: number;
  title: string;
  body: string;
  hint?: string;
  position?: 'top-left' | 'bottom-center' | 'middle' | 'top-center';
};
export const CoachMark: React.FC<CoachMarkProps> = ({ step, total, title, body, hint, position = 'bottom-center' }) => {
  // Suppress when the storyboard is embedded inside the live tutorial — the host
  // PhasePreview supplies its own (more authoritative) coach card.
  const { embedded } = React.useContext(StoryboardContext);
  if (embedded) return null;
  const positions: Record<NonNullable<CoachMarkProps['position']>, React.CSSProperties> = {
    'top-left':       { top: 70, left: 16, right: 16 },
    'bottom-center':  { bottom: 100, left: 12, right: 12 },
    'middle':         { top: '40%', left: 16, right: 16 },
    'top-center':     { top: 76, left: 12, right: 12 },
  };
  // Cream sticky-note skin — friendly hand-off voice that reads as guidance, not authority.
  const skin = {
    background: '#FFF8E6',
    color: DS.slate900,
    border: `1px solid ${DS.amberBorder}`,
    boxShadow: '0 18px 40px rgba(15,23,42,0.18), 0 2px 4px rgba(15,23,42,0.08)',
    transform: 'rotate(-1.2deg)',
    titleColor: DS.slate900,
    bodyColor: DS.slate700,
    pipBg: DS.amberBorder, pipMute: '#EBDFB1', pipActive: DS.peachInk,
    stepLabelColor: DS.slate500,
  };
  return (
    <div style={{
      position: 'absolute',
      ...positions[position],
      background: skin.background, color: skin.color,
      border: skin.border,
      borderRadius: 14, padding: '12px 14px',
      boxShadow: skin.boxShadow,
      transform: skin.transform,
      fontFamily: DS.font, zIndex: 30,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{
              width: i === step ? 12 : 4, height: 4, borderRadius: 2,
              background: i === step ? skin.pipActive : (i < step ? skin.pipBg : skin.pipMute),
            }} />
          ))}
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, color: skin.stepLabelColor, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          {step + 1} of {total}
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, letterSpacing: -0.1, color: skin.titleColor }}>{title}</div>
      <div style={{ fontSize: 11, lineHeight: 1.45, color: skin.bodyColor }}>{body}</div>
      {hint && (
        <div style={{
          marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 9, fontWeight: 700,
          color: DS.peachInk,
          letterSpacing: 0.4, textTransform: 'uppercase',
        }}>
          <span style={{ width: 4, height: 4, borderRadius: 2, background: DS.peachInk, animation: 'pulseBreathe 1.6s ease-in-out infinite' }} />
          {hint}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Phone-frame wrapper. Inner phone is sized smaller than the outer
// artboard so the 9px bezel + drop-shadow + step label all fit.
// ─────────────────────────────────────────────────────────────
type ScreenFrameProps = { children: React.ReactNode; label?: string; idx?: number; total?: number };
export const ScreenFrame: React.FC<ScreenFrameProps> = ({ children, label, idx, total }) => {
  const { embedded } = React.useContext(StoryboardContext);
  // Embedded mode (live tutorial) drops the bottom step label and the extra padding,
  // since the host already shows "Step N of M" in its top bar.
  return (
  <div style={{
    width: '100%', height: '100%',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    paddingTop: embedded ? 0 : 8,
    paddingBottom: embedded ? 0 : 32,
    position: 'relative',
    fontFamily: DS.font,
    boxSizing: 'border-box',
  }}>
    <div style={{
      width: 320, height: 632,
      background: DS.slate50,
      borderRadius: 36, overflow: 'hidden',
      position: 'relative',
      border: `9px solid ${DS.slate900}`,
      boxShadow: '0 28px 60px rgba(15,23,42,0.22), 0 6px 16px rgba(15,23,42,0.10)',
      fontFamily: DS.font,
    }}>
      <div style={{
        height: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 18px 0', background: '#fff',
        fontSize: 11, fontWeight: 700, color: DS.slate900,
        flexShrink: 0,
      }}>
        <span>9:41</span>
        <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ width: 14, height: 8, border: `1px solid ${DS.slate900}`, borderRadius: 2, position: 'relative', display: 'inline-block' }}>
            <span style={{ position: 'absolute', inset: 1, background: DS.slate900, borderRadius: 1 }} />
          </span>
        </span>
      </div>
      <div style={{ height: 'calc(100% - 24px)', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
    {label && !embedded && (
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        fontSize: 10, fontWeight: 700, color: DS.slate600, whiteSpace: 'nowrap',
        fontFamily: DS.font,
      }}>
        {idx != null && <span style={{ color: DS.indigo, marginRight: 6 }}>Step {idx}{total ? ` / ${total}` : ''}</span>}
        {label}
      </div>
    )}
  </div>
  );
};
