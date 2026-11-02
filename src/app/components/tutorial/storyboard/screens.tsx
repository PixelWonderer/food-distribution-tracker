import React from 'react';

import { DS } from './tokens';
import {
  TrackerHeader,
  TrackerTabBar,
  ScreenFrame,
  CoachMark,
  ConfirmRow,
  ConfirmGroupHeader,
  ConfirmSubhead,
  ConfirmProgress,
  BulkCommitBar,
  TeammateAttribution,
  StorageFilterChips,
  StorageRow,
  StorageCard,
  StorageStoredFold,
  InvHeader,
  QuantityBadge,
} from './primitives';

const TOTAL = 15;

// ─── Screen 01: Welcome ───────────────────────────────────────
export const ScreenWelcome: React.FC = () => (
  <ScreenFrame label="Welcome" idx={1} total={TOTAL}>
    <TrackerHeader status={{ label: 'Live', color: DS.greenInk, breathe: true }} demo />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 18, textAlign: 'center', position: 'relative' }}>
      <div style={{
        width: 92, height: 92, borderRadius: 26, background: DS.indigoSoft,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48,
        marginBottom: 18, boxShadow: `0 8px 32px ${DS.indigo}40`,
      }}>🍜</div>
      <div style={{ fontSize: 21, fontWeight: 800, color: DS.slate900, letterSpacing: -0.4, marginBottom: 6 }}>Welcome, volunteer.</div>
      <div style={{ fontSize: 12.5, lineHeight: 1.5, color: DS.slate600, maxWidth: 260, marginBottom: 20 }}>
        Track every box, every pickup, every Friday. We&apos;ll walk through the four phases — practice with sample data, nothing saves.
      </div>
      {/* Decorative — the real CTA lives in the host coach card. Cursor:default
          and aria-hidden so users don't try to tap it (functional review found
          this caused confusion when the mockup CTA looked clickable). */}
      <div aria-hidden style={{
        background: DS.indigo, color: '#fff', padding: '12px 26px',
        borderRadius: 12, fontSize: 14, fontWeight: 700, letterSpacing: -0.1,
        boxShadow: `0 6px 16px ${DS.indigo}55`, cursor: 'default',
        opacity: 0.85,
      }}>Start tour →</div>
      <div style={{ fontSize: 10, color: DS.slate500, marginTop: 14 }}>About 4 minutes</div>
    </div>
    <TrackerTabBar active="confirm" counts={{ confirm: '0/8', storage: '0/9', pickup: '0/9', inventory: '0/24' }} />
  </ScreenFrame>
);

// ─── Screen 02: Workflow Map ──────────────────────────────────
export const ScreenWorkflowMap: React.FC = () => (
  <ScreenFrame label="The four phases" idx={2} total={TOTAL}>
    <TrackerHeader demo />
    <div style={{ flex: 1, padding: 16, position: 'relative' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: DS.slate500, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 }}>Your weekly flow</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: DS.slate900, letterSpacing: -0.3, marginBottom: 14 }}>Confirm → Store → Pickup → Track</div>
      {[
        { n: 1, icon: '✓', tone: DS.greenInk, bg: DS.greenSoft, t: 'Confirm', d: 'Truck arrives. Tap rows to flag low/out, then bulk-commit the rest as expected.' },
        { n: 2, icon: '📦', tone: DS.indigo, bg: DS.indigoSoft, t: 'Store', d: 'Fridge or table. Tick checkboxes as you put items away.' },
        { n: 3, icon: '🚚', tone: DS.peachInk, bg: DS.peachSoft, t: 'Pickup', d: 'Volunteers swing by. Mark per destination.' },
        { n: 4, icon: '📋', tone: DS.slate700, bg: DS.slate100, t: 'Inventory', d: "Shelf-count the pantry. Spot what's running low." },
      ].map((s, i) => (
        <div key={i} style={{
          display: 'flex', gap: 11, alignItems: 'center',
          background: '#fff', padding: 11, borderRadius: 14, marginBottom: 8,
          border: `1px solid ${DS.slate200}`,
          boxShadow: '0 1px 2px rgba(14,16,32,.04)',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 11,
            background: s.bg, color: s.tone,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, fontWeight: 800,
          }}>{s.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: DS.slate900 }}>{s.n}. {s.t}</div>
            <div style={{ fontSize: 10.5, color: DS.slate600, marginTop: 1, lineHeight: 1.4 }}>{s.d}</div>
          </div>
          <div style={{ color: DS.slate300, fontSize: 16, fontWeight: 600 }}>›</div>
        </div>
      ))}
    </div>
    <TrackerTabBar active="confirm" counts={{ confirm: '0/8', storage: '0/9', pickup: '0/9', inventory: '0/24' }} />
  </ScreenFrame>
);

// ─── Phase 1: Confirm — pristine ──────────────────────────────
export const ScreenConfirmIntro: React.FC = () => (
  <ScreenFrame label="Confirm — pristine" idx={3} total={TOTAL}>
    <TrackerHeader demo />
    <div style={{ flex: 1, padding: '8px 12px', overflow: 'hidden' }}>
      <ConfirmProgress done={0} total={8} />
      <ConfirmGroupHeader icon="🧊" label="Fridge" done={0} total={4} />
      <ConfirmSubhead label="Pending" count="4 left" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ConfirmRow emoji="🥛" name="Whole Milk" qty={8} unit="gal" state="pending" />
        <ConfirmRow emoji="🥚" name="Eggs" qty={12} unit="dozen" state="pending" />
        <ConfirmRow emoji="🧀" name="Cheddar" qty={4} unit="lb" state="pending" />
        <ConfirmRow emoji="🍶" name="Yogurt" qty={12} unit="cups" state="pending" />
      </div>
    </div>
    <TrackerTabBar active="confirm" counts={{ confirm: '0/8', storage: '0/9', pickup: '0/9', inventory: '0/24' }} />
    <CoachMark step={2} total={TOTAL} title="Phase 1 — what arrived?" body="Every line item starts pending. Most days the truck delivers exactly what was ordered, so you'll just bulk-confirm at the bottom. Flag any exceptions first by tapping the row." position="bottom-center" hint="Tap a row to flag" />
  </ScreenFrame>
);

// ─── Phase 1: Confirm — tap to flag ran-low ───────────────────
export const ScreenConfirmTapToFlag: React.FC = () => (
  <ScreenFrame label="Tap row → flag ran-low" idx={4} total={TOTAL}>
    <TrackerHeader demo />
    <div style={{ flex: 1, padding: '8px 12px', overflow: 'hidden', position: 'relative' }}>
      <ConfirmProgress done={0} total={8} />
      <ConfirmGroupHeader icon="🧊" label="Fridge" done={0} total={4} />
      <ConfirmSubhead label="Pending" count="4 left" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ConfirmRow emoji="🥛" name="Whole Milk" qty={8} unit="gal" state="pending" />
        <ConfirmRow emoji="🥚" name="Eggs" qty={12} unit="dozen" state="staged-low" receivedQty={9} highlight />
        <ConfirmRow emoji="🧀" name="Cheddar" qty={4} unit="lb" state="pending" />
        <ConfirmRow emoji="🍶" name="Yogurt" qty={12} unit="cups" state="pending" />
      </div>
    </div>
    <TrackerTabBar active="confirm" counts={{ confirm: '0/8', storage: '0/9', pickup: '0/9', inventory: '0/24' }} />
    <CoachMark step={3} total={TOTAL} title="One tap → ran low" body={'Tap the egg row once: it stages as "Flagged ran low", with an inline stepper to dial in what actually arrived. Nothing\'s saved yet — staged flags are local until you bulk-confirm.'} position="top-center" hint="Tap again for ran-out" />
  </ScreenFrame>
);

// ─── Phase 1: Confirm — tap again → ran-out ───────────────────
export const ScreenConfirmTapAgain: React.FC = () => (
  <ScreenFrame label="Tap again → flag ran-out" idx={5} total={TOTAL}>
    <TrackerHeader demo />
    <div style={{ flex: 1, padding: '8px 12px', overflow: 'hidden', position: 'relative' }}>
      <ConfirmProgress done={0} total={8} />
      <ConfirmGroupHeader icon="🧊" label="Fridge" done={0} total={4} />
      <ConfirmSubhead label="Pending" count="4 left" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ConfirmRow emoji="🥛" name="Whole Milk" qty={8} unit="gal" state="pending" />
        <ConfirmRow emoji="🥚" name="Eggs" qty={12} unit="dozen" state="staged-low" receivedQty={9} />
        <ConfirmRow emoji="🧀" name="Cheddar" qty={4} unit="lb" state="staged-out" highlight />
        <ConfirmRow emoji="🍶" name="Yogurt" qty={12} unit="cups" state="pending" />
      </div>
    </div>
    <TrackerTabBar active="confirm" counts={{ confirm: '0/8', storage: '0/9', pickup: '0/9', inventory: '0/24' }} />
    <CoachMark step={4} total={TOTAL} title="Cheddar didn't make it" body={'Second tap on cheddar cycles to "Flagged ran out". A third tap clears the flag entirely and goes back to pending. The cycle is: pending → low → out → clear.'} position="top-center" />
  </ScreenFrame>
);

// ─── Phase 1: Bulk commit bar ─────────────────────────────────
export const ScreenConfirmBulkBar: React.FC = () => (
  <ScreenFrame label="Bulk commit bar" idx={6} total={TOTAL}>
    <TrackerHeader demo />
    <div style={{ flex: 1, padding: '8px 12px', overflow: 'hidden', position: 'relative' }}>
      <ConfirmProgress done={0} total={8} />
      <ConfirmGroupHeader icon="🧊" label="Fridge" done={0} total={4} />
      <ConfirmSubhead label="Pending" count="4 left" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ConfirmRow emoji="🥛" name="Whole Milk" qty={8} unit="gal" state="pending" />
        <ConfirmRow emoji="🥚" name="Eggs" qty={12} unit="dozen" state="staged-low" receivedQty={9} />
        <ConfirmRow emoji="🧀" name="Cheddar" qty={4} unit="lb" state="staged-out" />
      </div>
      <BulkCommitBar expected={2} low={1} out={1} highlight />
    </div>
    <TrackerTabBar active="confirm" counts={{ confirm: '0/8', storage: '0/9', pickup: '0/9', inventory: '0/24' }} />
    <CoachMark step={5} total={TOTAL} title="One tap commits everything" body="The bar at the bottom totals all four pending rows. Tapping it commits the two flagged exceptions plus the two unflagged rows (as expected) — in one atomic write." position="top-center" hint="Read the breakdown" />
  </ScreenFrame>
);

// ─── Phase 1: After commit (multi-volunteer sync) ─────────────
export const ScreenConfirmCommitted: React.FC = () => (
  <ScreenFrame label="After commit" idx={7} total={TOTAL}>
    <TrackerHeader demo />
    <div style={{ flex: 1, padding: '8px 12px', overflow: 'hidden' }}>
      <ConfirmProgress done={4} total={8} />
      <ConfirmGroupHeader icon="🧊" label="Fridge" done={4} total={4} />
      <ConfirmSubhead label="Done" count={4} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ConfirmRow emoji="🥛" name="Whole Milk" qty={8} unit="gal" state="expected" showInfo={false} />
        <ConfirmRow emoji="🥚" name="Eggs" qty={12} unit="dozen" state="low" receivedQty={9} showInfo={false} />
        <ConfirmRow emoji="🧀" name="Cheddar" qty={4} unit="lb" state="out" showInfo={false} />
        <ConfirmRow emoji="🍶" name="Yogurt" qty={12} unit="cups" state="expected" showInfo={false} teammateBorder />
      </div>
      <TeammateAttribution name="Joaquin" item="Yogurt" />
    </div>
    <TrackerTabBar active="confirm" counts={{ confirm: '4/8', storage: '0/9', pickup: '0/9', inventory: '0/24' }} />
    <CoachMark step={6} total={TOTAL} title="Live multi-volunteer sync" body={"Status pills go solid: green ✓ Confirmed, peach ⊙ Ran low · rec'd 9, red × Ran out. The mint border + dashed card show another volunteer (Joaquin) just confirmed yogurt — you don't need to re-check it."} position="bottom-center" />
  </ScreenFrame>
);

// ─── Phase 2: Storage — sections ──────────────────────────────
export const ScreenStorage: React.FC = () => (
  <ScreenFrame label="Storage — sections" idx={8} total={TOTAL}>
    <TrackerHeader demo />
    <div style={{ flex: 1, padding: '8px 12px', overflow: 'hidden', position: 'relative' }}>
      <StorageFilterChips active="all" counts={{ all: 9, fridge: 5, table: 4 }} />
      <StorageCard icon="🧊" title="Fridge items" done={2} total={5}>
        <StorageRow emoji="🥛" name="Whole Milk" qty="5 gal" packed />
        <StorageRow emoji="🥚" name="Eggs" qty="6 dozen" packed />
        <StorageRow emoji="🍶" name="Yogurt" qty="12 cups" highlightCheckbox isLast />
      </StorageCard>
      <StorageCard icon="🟫" title="Table items" done={1} total={4}>
        <StorageRow emoji="🥖" name="Sourdough Bread" qty="24 loaves" />
        <StorageRow emoji="🍝" name="Pasta" qty="8 boxes" packed isLast />
      </StorageCard>
    </div>
    <TrackerTabBar active="storage" counts={{ confirm: '8/8', storage: '3/9', pickup: '0/9', inventory: '0/24' }} />
    <CoachMark step={7} total={TOTAL} title="Tap as you stash" body={'Items split into 🧊 Fridge and 🟫 Table cards. Tick checkboxes one by one, or hit "✓ All" in the section header to clear it. Stored rows turn mint with a strikethrough; another volunteer\'s checks sync in instantly.'} position="bottom-center" hint="Tap yogurt" />
  </ScreenFrame>
);

// ─── Phase 2: Storage — section done ──────────────────────────
export const ScreenStorageDone: React.FC = () => (
  <ScreenFrame label="Storage — section done" idx={9} total={TOTAL}>
    <TrackerHeader demo />
    <div style={{ flex: 1, padding: '8px 12px', overflow: 'hidden' }}>
      <StorageFilterChips active="fridge" counts={{ all: 9, fridge: 5, table: 4 }} />
      <StorageCard icon="🧊" title="Fridge items" done={5} total={5} highlightAllBtn>
        <StorageStoredFold count={5} />
      </StorageCard>
    </div>
    <TrackerTabBar active="storage" counts={{ confirm: '8/8', storage: '5/9', pickup: '0/9', inventory: '0/24' }} />
    <CoachMark step={8} total={TOTAL} title="Section complete" body={'When every row in a section is stored, the rows collapse into a quiet "5 stored — Show" strip so the screen stays focused on whatever\'s still pending. The Fridge chip up top jumps to 5 of 5.'} position="bottom-center" />
  </ScreenFrame>
);

// ─── Phase 3: Pickup — chips ──────────────────────────────────
export const ScreenPickupChips: React.FC = () => (
  <ScreenFrame label="Pickup — filter to your slot" idx={10} total={TOTAL}>
    <TrackerHeader demo />
    <div style={{ background: '#fff', padding: '8px 12px', borderBottom: `1px solid ${DS.slate200}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 6, overflow: 'hidden' }}>
        {['All', 'Fri AM', 'Fri noon', 'Fri PM', 'Sat', 'Sunday'].map((c) => {
          const active = c === 'Sunday';
          return (
            <div key={c} style={{
              padding: '5px 11px', borderRadius: 999,
              fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
              background: active ? DS.indigo : '#fff',
              color: active ? '#fff' : DS.slate700,
              border: `1px solid ${active ? DS.indigo : DS.slate200}`,
              boxShadow: active ? `0 0 0 4px ${DS.indigoSoft}, 0 4px 8px ${DS.indigo}40` : 'none',
            }}>{c}</div>
          );
        })}
      </div>
    </div>
    <div style={{ flex: 1, padding: '10px 12px', overflow: 'hidden' }}>
      <div style={{
        background: '#fff', borderRadius: 18, padding: 12, marginBottom: 8,
        border: `1px solid ${DS.slate200}`,
        boxShadow: '0 1px 2px rgba(14,16,32,.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: DS.slate900, letterSpacing: -0.2 }}>Partner Group 7</div>
            <div style={{ fontSize: 10.5, color: DS.slate600, marginTop: 1 }}>Sun · 5:00 PM · 6 items</div>
          </div>
          <div style={{
            fontSize: 9.5, fontWeight: 700, color: DS.indigo,
            padding: '5px 10px', borderRadius: 999, border: `1px solid ${DS.indigoSoft}`,
            background: '#fff',
          }}>✓ All picked up</div>
        </div>
        <div style={{ marginTop: 10, height: 5, borderRadius: 3, background: DS.slate100, position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, width: '33%', background: `linear-gradient(90deg, ${DS.indigo}, ${DS.indigoDeep})`, borderRadius: 3 }} />
        </div>
        <div style={{ fontSize: 9.5, fontWeight: 600, color: DS.slate500, marginTop: 5, fontFamily: DS.mono }}>2 / 6 picked up</div>
      </div>
      <div style={{
        background: DS.slate50, border: `1px dashed ${DS.slate200}`,
        borderRadius: 14, padding: 16, textAlign: 'center',
        color: DS.slate500, fontSize: 11, fontWeight: 500,
      }}>
        5 destinations hidden by Sunday filter
      </div>
    </div>
    <TrackerTabBar active="pickup" counts={{ confirm: '8/8', storage: '9/9', pickup: '0/6', inventory: '0/24' }} />
    <CoachMark step={9} total={TOTAL} title="Filter to your time slot" body="Time chips snap the list to one window. Sunday hides Friday and Saturday cards entirely so volunteers running the Partner Group 7 crew see only their work." position="bottom-center" />
  </ScreenFrame>
);

// ─── Phase 3: Pickup — destination card ───────────────────────
export const ScreenPickupDetail: React.FC = () => (
  <ScreenFrame label="Pickup — destination card" idx={11} total={TOTAL}>
    <TrackerHeader demo />
    <div style={{ flex: 1, padding: '10px 12px', overflow: 'hidden' }}>
      <div style={{
        background: '#fff', borderRadius: 18, padding: 12,
        border: `1px solid ${DS.slate200}`,
        boxShadow: '0 1px 2px rgba(14,16,32,.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: DS.slate900, letterSpacing: -0.2 }}>Co-op A</div>
            <div style={{ fontSize: 10.5, color: DS.slate600, marginTop: 1 }}>Fri noon · driver: Joaquin</div>
          </div>
          <div style={{
            fontSize: 9.5, fontWeight: 800, color: DS.greenInk,
            padding: '3px 9px', background: DS.greenSoft, borderRadius: 999,
            border: `1px solid ${DS.greenBorder}`,
            fontFamily: DS.mono,
          }}>3 / 5</div>
        </div>
        <div style={{ height: 1, background: DS.slate100, margin: '8px 0' }} />
        {[
          { e: '🥛', n: 'Milk', q: '2 gal', c: true },
          { e: '🥚', n: 'Eggs', q: '2 dozen', c: true },
          { e: '🥬', n: 'Produce', q: '1 crate', c: true },
          { e: '🍝', n: 'Pasta', q: '2 boxes', c: false, h: true },
          { e: '🧀', n: 'Cheddar', q: '1 lb', c: false },
        ].map((r, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '6px 4px',
            background: r.h ? `${DS.indigoSoft}90` : 'transparent', borderRadius: 8,
            margin: r.h ? '0 -4px' : 0,
            boxShadow: r.h ? `0 0 0 1.5px ${DS.indigo}` : 'none',
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 6,
              border: `1.5px solid ${r.c ? DS.greenInk : DS.slate300}`,
              background: r.c ? DS.greenInk : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              flexShrink: 0,
            }}>
              {r.c && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>
            <span aria-hidden style={{ fontSize: 16 }}>{r.e}</span>
            <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: r.c ? DS.slate500 : DS.slate900, textDecoration: r.c ? 'line-through' : 'none' }}>{r.n}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: DS.slate500, fontFamily: DS.mono }}>{r.q}</div>
          </div>
        ))}
      </div>
    </div>
    <TrackerTabBar active="pickup" counts={{ confirm: '8/8', storage: '9/9', pickup: '0/6', inventory: '0/24' }} />
    <CoachMark step={10} total={TOTAL} title="Per-destination cards" body={"Tap each item as it goes out the door. The 3/5 badge tracks completion live; full destinations collapse to a 'Done' fold like Storage."} position="bottom-center" hint="Tap pasta" />
  </ScreenFrame>
);

// ─── Phase 4: Inventory — Browse mode ─────────────────────────
export const ScreenInventoryBrowse: React.FC = () => (
  <ScreenFrame label="Inventory — Browse mode" idx={12} total={TOTAL}>
    <TrackerHeader demo />
    <div style={{ flex: 1, padding: '8px 12px', overflow: 'hidden' }}>
      <InvHeader active="browse" />
      <div style={{ marginTop: 10, display: 'flex', gap: 6, overflow: 'hidden' }}>
        {[
          { id: 'all', l: 'All', i: '📦', c: 142, active: true },
          { id: 'beans', l: 'Beans', i: '🫘', c: 18 },
          { id: 'grains', l: 'Grains', i: '🌾', c: 24 },
          { id: 'canned', l: 'Canned', i: '🥫', c: 41 },
          { id: 'cond', l: 'Condiments', i: '🌶️', c: 27 },
        ].map((c) => (
          <div key={c.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '5px 10px', borderRadius: 999,
            background: c.active ? DS.slate900 : '#fff',
            color: c.active ? '#fff' : DS.slate700,
            border: `1px solid ${c.active ? DS.slate900 : DS.slate200}`,
            fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            <span aria-hidden>{c.i}</span>{c.l}
            <span style={{ marginLeft: 2, fontSize: 9, fontWeight: 700, opacity: c.active ? 0.7 : 0.5 }}>{c.c}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { e: '🫘', n: 'Black Beans, dry', q: 14, u: 'lb', cat: 'Beans & Legumes' },
          { e: '🍚', n: 'Brown Rice', q: 22, u: 'lb', cat: 'Grains & Pasta' },
          { e: '🍅', n: 'Crushed Tomato 28oz', q: 18, u: 'cans', cat: 'Canned Goods' },
          { e: '🫒', n: 'Olive Oil', q: 2, u: 'btl', cat: 'Condiments & Sauces', low: true },
          { e: '🥜', n: 'Tahini', q: 1, u: 'jar', cat: 'Condiments & Sauces', low: true },
        ].map((r, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 11px', background: '#fff', borderRadius: 14,
            border: `1px solid ${DS.slate200}`,
            boxShadow: '0 1px 2px rgba(14,16,32,.04)',
          }}>
            <span aria-hidden style={{ fontSize: 22, width: 26, textAlign: 'center' }}>{r.e}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: DS.slate900, letterSpacing: -0.1 }}>{r.n}</span>
                {r.low && <span style={{
                  fontSize: 8.5, fontWeight: 800, color: DS.peachInk,
                  padding: '1px 5px', background: DS.peachSoft, borderRadius: 999,
                  border: `1px solid ${DS.peachBorder}`, letterSpacing: 0.4,
                }}>LOW</span>}
              </div>
              <div style={{ fontSize: 9.5, color: DS.slate500, marginTop: 1 }}>{r.cat}</div>
            </div>
            <QuantityBadge qty={`${r.q} ${r.u}`} tone={r.low ? 'peach' : 'lavender'} />
          </div>
        ))}
      </div>
    </div>
    <TrackerTabBar active="inventory" counts={{ confirm: '8/8', storage: '9/9', pickup: '6/6', inventory: '0/24' }} />
    <CoachMark step={11} total={TOTAL} title="Browse — see what's stocked" body={"The first mode is reference-only: scan the pantry by category, see live quantities and LOW flags. Use it before you reach for an ingredient or to answer 'do we have tahini?' fast."} position="bottom-center" />
  </ScreenFrame>
);

// ─── Phase 4: Inventory — Count mode ──────────────────────────
export const ScreenInventoryCount: React.FC = () => (
  <ScreenFrame label="Inventory — Count mode" idx={13} total={TOTAL}>
    <TrackerHeader demo />
    <div style={{ flex: 1, padding: '8px 12px', overflow: 'hidden' }}>
      <InvHeader active="count" />
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { e: '🫒', n: 'Olive Oil', q: 2, t: 6, low: true },
          { e: '🫘', n: 'Black Beans, dry', q: 14, t: 10 },
          { e: '🌾', n: 'Quinoa', q: 5, t: 8, low: true },
          { e: '🍅', n: 'Crushed Tomato 28oz', q: 18, t: 12 },
          { e: '🥜', n: 'Tahini', q: 1, t: 4, low: true, h: true },
        ].map((r, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 11px', background: '#fff', borderRadius: 14,
            border: `1px solid ${DS.slate200}`,
            boxShadow: r.h ? `0 0 0 2px ${DS.indigo}, 0 4px 14px ${DS.indigo}40` : '0 1px 2px rgba(14,16,32,.04)',
          }}>
            <span aria-hidden style={{ fontSize: 22, width: 26, textAlign: 'center' }}>{r.e}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: DS.slate900, letterSpacing: -0.1 }}>{r.n}</span>
                {r.low && <span style={{
                  fontSize: 8.5, fontWeight: 800, color: DS.peachInk,
                  padding: '1px 5px', background: DS.peachSoft, borderRadius: 999,
                  border: `1px solid ${DS.peachBorder}`, letterSpacing: 0.4,
                }}>LOW</span>}
              </div>
              <div style={{ fontSize: 9.5, color: DS.slate500, marginTop: 1, fontFamily: DS.mono }}>min {r.t}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${DS.slate200}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: DS.slate600, background: '#fff' }}>−</div>
              <div style={{ minWidth: 22, textAlign: 'center', fontSize: 14, fontWeight: 800, color: r.low ? DS.peachInk : DS.slate900, fontFamily: DS.mono }}>{r.q}</div>
              <div style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${DS.indigo}`, background: DS.indigoSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: DS.indigo }}>+</div>
            </div>
          </div>
        ))}
      </div>
    </div>
    <TrackerTabBar active="inventory" counts={{ confirm: '8/8', storage: '9/9', pickup: '6/6', inventory: '4/24' }} />
    <CoachMark step={12} total={TOTAL} title="Count mode — shelf reality" body="Inventory has three modes: Browse (take items), Count (this — match shelf), Reorder (suggestions). Bump quantities to match what's actually on the shelf; LOW pills auto-flag below par." position="bottom-center" />
  </ScreenFrame>
);

// ─── Phase 4: Inventory — Reorder mode ────────────────────────
export const ScreenInventoryReorder: React.FC = () => (
  <ScreenFrame label="Inventory — Reorder mode" idx={14} total={TOTAL}>
    <TrackerHeader demo />
    <div style={{ flex: 1, padding: '8px 12px', overflow: 'hidden' }}>
      <InvHeader active="reorder" />
      <div style={{
        marginTop: 10,
        background: DS.amberSoft, borderRadius: 14, padding: '10px 12px',
        border: `1px solid ${DS.amberBorder}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: DS.amberInk }}>3 items below threshold</div>
          <div style={{ fontSize: 10, color: DS.amberInk, opacity: 0.85, marginTop: 1 }}>Suggested for next week&apos;s Food Bank order</div>
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { e: '🫒', n: 'Olive Oil', q: 2, t: 6, suggest: 8 },
          { e: '🌾', n: 'Quinoa', q: 5, t: 8, suggest: 5 },
          { e: '🥜', n: 'Tahini', q: 1, t: 4, suggest: 6 },
        ].map((r, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', background: '#fff', borderRadius: 14,
            border: `1px solid ${DS.slate200}`,
            boxShadow: '0 1px 2px rgba(14,16,32,.04)',
          }}>
            <span aria-hidden style={{ fontSize: 22, width: 26, textAlign: 'center' }}>{r.e}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: DS.slate900, letterSpacing: -0.1 }}>{r.n}</div>
              <div style={{ fontSize: 9.5, color: DS.slate500, marginTop: 1, fontFamily: DS.mono }}>have {r.q} · min {r.t}</div>
            </div>
            <div style={{
              padding: '6px 10px', borderRadius: 999,
              background: DS.indigo, color: '#fff',
              fontSize: 11, fontWeight: 700,
              fontFamily: DS.mono,
            }}>+{r.suggest}</div>
          </div>
        ))}
      </div>
    </div>
    <TrackerTabBar active="inventory" counts={{ confirm: '8/8', storage: '9/9', pickup: '6/6', inventory: '24/24' }} />
    <CoachMark step={13} total={TOTAL} title="Reorder — auto-suggested cart" body="Reorder mode reads your Count results and proposes quantities for next week's Food Bank order. Tap a suggestion to bump it up or down; the page hands the final list back to whoever runs procurement." position="bottom-center" />
  </ScreenFrame>
);

// ─── Power tools: Quick Actions ───────────────────────────────
type QuickActionTone = 'saffron' | 'indigo' | 'slate';
type QuickAction = {
  i: string;
  t: string;
  d: string;
  tone: QuickActionTone;
  accent?: boolean;
  external?: boolean;
  badge?: string;
};

export const ScreenQuickActions: React.FC = () => {
  const everydayActions: QuickAction[] = [
    { i: '🔐', t: 'Door Unlock Code', d: 'Access storage area', tone: 'saffron', accent: true },
    { i: '📱', t: 'Show QR Code', d: 'Share tracker with volunteers', tone: 'indigo' },
    { i: '📊', t: 'View Source Sheet', d: 'Open the data spreadsheet', tone: 'slate', external: true },
    { i: '📋', t: 'Shift Tasks', d: 'Showing in Pickup tab', tone: 'saffron', badge: 'On' },
  ];
  const helpActions: QuickAction[] = [
    { i: '🎯', t: 'Interactive tutorial', d: 'Step-by-step walkthrough', tone: 'indigo' },
    { i: '⚙️', t: 'Preferences', d: 'Layout, filters, volunteer name', tone: 'saffron' },
  ];
  const tones: Record<QuickActionTone, { bg: string; fg: string }> = {
    saffron: { bg: DS.amberSoft, fg: '#C99B00' },
    indigo:  { bg: DS.indigoSoft, fg: DS.indigoDeep },
    slate:   { bg: DS.slate100, fg: DS.slate700 },
  };
  return (
    <ScreenFrame label="Quick Actions" idx={15} total={TOTAL}>
      <TrackerHeader demo highlightMore />
      <div style={{ flex: 1, position: 'relative', background: 'rgba(15,23,42,0.45)' }}>
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: '#fff', borderRadius: '24px 24px 0 0',
          padding: '8px 14px 16px',
          boxShadow: '0 -20px 40px rgba(0,0,0,0.2)',
          maxHeight: '92%', overflow: 'hidden',
        }}>
          <div style={{ width: 38, height: 4, background: DS.slate200, borderRadius: 2, margin: '4px auto 8px' }} />
          <div style={{ fontSize: 16, fontWeight: 800, color: DS.slate900, letterSpacing: -0.3 }}>Quick Actions</div>
          <div style={{ fontSize: 10.5, color: DS.slate600, marginBottom: 10 }}>🔓 Full Access</div>

          <div style={{ fontSize: 9, fontWeight: 700, color: DS.slate600, textTransform: 'uppercase', letterSpacing: 1.2, padding: '0 2px 4px' }}>Your role</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, padding: 6, background: '#F6F7FA', borderRadius: 11, border: `1px solid ${DS.slate200}`, marginBottom: 10 }}>
            {[
              { i: '🍳', l: 'Cook', active: false },
              { i: '🚚', l: 'Driver', active: false },
              { i: '📦', l: 'Storage', active: false },
              { i: '🔓', l: 'Full', active: true },
            ].map((r, i) => (
              <div key={i} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                minHeight: 42, padding: '5px 0',
                background: r.active ? DS.indigoSoft : '#fff',
                border: `1px solid ${r.active ? '#CFC9FF' : 'transparent'}`,
                color: r.active ? DS.indigoDeep : DS.slate600,
                borderRadius: 8, fontSize: 9, fontWeight: 700,
              }}>
                <span style={{ fontSize: 14 }}>{r.i}</span>{r.l}
              </div>
            ))}
          </div>

          <div style={{ fontSize: 9, fontWeight: 700, color: DS.slate600, textTransform: 'uppercase', letterSpacing: 1.2, padding: '4px 2px 4px' }}>Everyday</div>
          {everydayActions.map((a, i) => {
            const t = tones[a.tone];
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '7px 10px', borderRadius: 12,
                background: a.accent ? '#FFF5D199' : '#fff',
                border: `1px solid ${a.accent ? '#F8D979' : DS.slate200}`,
                marginBottom: 4,
                boxShadow: a.accent ? `0 0 0 2px ${DS.indigo}` : 'none',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: t.bg, color: t.fg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
                }}>{a.i}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: DS.slate900, letterSpacing: -0.1 }}>{a.t}</div>
                  <div style={{ fontSize: 9.5, color: DS.slate600, marginTop: 1 }}>{a.d}</div>
                </div>
                {a.badge && <span style={{ padding: '2px 7px', background: DS.greenSoft, color: DS.greenInk, border: `1px solid ${DS.greenBorder}`, borderRadius: 999, fontSize: 9, fontWeight: 700 }}>{a.badge}</span>}
                {a.external ? <span style={{ color: DS.slate400, fontSize: 13 }}>↗</span> : !a.badge && <span style={{ color: DS.slate400, fontSize: 14 }}>›</span>}
              </div>
            );
          })}

          <div style={{ fontSize: 9, fontWeight: 700, color: DS.slate600, textTransform: 'uppercase', letterSpacing: 1.2, padding: '6px 2px 4px' }}>Help</div>
          {helpActions.map((a, i) => {
            const t = tones[a.tone];
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '7px 10px', borderRadius: 12,
                background: '#fff', border: `1px solid ${DS.slate200}`,
                marginBottom: 4,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: t.bg, color: t.fg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
                }}>{a.i}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: DS.slate900, letterSpacing: -0.1 }}>{a.t}</div>
                  <div style={{ fontSize: 9.5, color: DS.slate600, marginTop: 1 }}>{a.d}</div>
                </div>
                <span style={{ color: DS.slate400, fontSize: 14 }}>›</span>
              </div>
            );
          })}
        </div>
      </div>
      <CoachMark step={14} total={TOTAL} title="The ⋮ menu" body="Quick Actions is the everything-else drawer. The saffron-bordered Door Unlock is the weekly-rhythm primary; QR code shares the tracker; the role grid up top swaps your filtered tab set instantly." position="top-center" hint="Highlighted = primary" />
    </ScreenFrame>
  );
};

// ─── Ordered list of screen renderers ─────────────────────────
export const STORYBOARD_SCREENS: React.FC[] = [
  ScreenWelcome,
  ScreenWorkflowMap,
  ScreenConfirmIntro,
  ScreenConfirmTapToFlag,
  ScreenConfirmTapAgain,
  ScreenConfirmBulkBar,
  ScreenConfirmCommitted,
  ScreenStorage,
  ScreenStorageDone,
  ScreenPickupChips,
  ScreenPickupDetail,
  ScreenInventoryBrowse,
  ScreenInventoryCount,
  ScreenInventoryReorder,
  ScreenQuickActions,
];
