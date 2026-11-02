import type { TutorialStep } from '@/types/tutorial';
import {
  ScreenWelcome,
  ScreenConfirmIntro,
  ScreenStorage,
  ScreenPickupChips,
  ScreenInventoryBrowse,
  ScreenQuickActions,
} from './storyboard/screens';

/**
 * Hybrid tutorial — preview mockups (storyboard) interleaved with interactive
 * spotlights on the real app. The volunteer learns by *doing* — taps a real
 * Confirm row to flag ran-low, switches a real Inventory mode, opens a real
 * Quick Actions sheet — with phase-intro previews bridging each section.
 *
 * Targets reference data-tutorial attributes already present in the app:
 *   - confirm-first-row, confirm-bulk-bar  (ConfirmationView)
 *   - storage-section-table, storage-checkbox, storage-mark-all  (StorageView)
 *   - pickup-chip-sunday, pickup-destination, pickup-mark-all  (PickupView)
 *   - inventory-mode-browse / -count / -reorder  (InventoryModeSelector)
 *   - quick-actions-button, door-unlock-qam, door-unlock-header  (Header / QuickActionsSheet)
 *
 * Copy is volunteer-facing: short, plain-English, no UI/dev jargon. The Milk /
 * Bread / Rice items named in hints come from the demo data injected when the
 * tutorial starts (see services/demoDataService.ts).
 */
export const tutorialSteps: TutorialStep[] = [
  // ─── Welcome ─────────────────────────────────────────────────
  {
    id: 'welcome',
    phase: 'welcome',
    type: 'preview',
    title: 'A quick walk-through',
    body: "Three of you can be working the same shift — whatever you tap shows up on everyone else's phone instantly. We'll practice with sample data, so nothing you tap saves. About 4 minutes.",
    ctaText: 'Start tour →',
    previewScreen: ScreenWelcome,
  },

  // ─── Phase 1 · Confirm ───────────────────────────────────────
  {
    id: 'confirm-preview',
    phase: 'confirmation',
    type: 'preview',
    title: 'Phase 1 — Confirm what arrived',
    body: "When Food Bank delivers, every item starts unconfirmed. Tap rows for anything short or missing, then hit the green bar at the bottom to save everything else as expected.",
    ctaText: 'Show me on the real app',
    previewScreen: ScreenConfirmIntro,
  },
  {
    id: 'confirm-tap-row',
    phase: 'confirmation',
    type: 'interactive',
    title: 'When something runs short',
    body: "Tap the Milk row. Each tap moves it through: ran low (set how much arrived), ran out, then back to normal. Try one tap.",
    hint: 'Tap the Milk row',
    successMessage: 'Flagged ran low.',
    requiredTab: 'orderConfirmation',
    target: 'confirm-first-row',
    waitForAction: { type: 'click', selector: 'confirm-first-row' },
    // `top` so the coach card sits above the row and doesn't cover the
    // InlineStepper that appears below the row when staged ran-low (Gemini v3
    // #2 — the toast / state-change feedback was being eaten by the card).
    placement: 'top',
    highlightPadding: 8,
  },
  {
    id: 'confirm-bulk',
    phase: 'confirmation',
    type: 'highlight',
    title: 'Save it all at once',
    body: "Tap the green bar to save everything in one go. The count shows what's about to save.",
    requiredTab: 'orderConfirmation',
    target: 'confirm-bulk-bar',
    placement: 'top',
    highlightPadding: 8,
  },

  // ─── Phase 2 · Storage ───────────────────────────────────────
  {
    id: 'storage-preview',
    phase: 'storage',
    type: 'preview',
    title: 'Phase 2 — Put things away',
    body: "Everyone working the shift sees your checkmarks live. Tap items as you put them away — fridge stuff goes up top, table stuff below. \"✓ All\" wraps a whole section in one tap.",
    ctaText: 'Try it on the real app',
    previewScreen: ScreenStorage,
  },
  {
    id: 'storage-checkbox',
    phase: 'storage',
    type: 'interactive',
    title: 'Mark it stored',
    body: "Tap the circle next to the highlighted item. Every volunteer's screen updates instantly so nobody double-stocks.",
    hint: 'Tap the circle',
    successMessage: 'Stored — synced to everyone.',
    requiredTab: 'storage',
    target: 'storage-checkbox',
    waitForAction: { type: 'click', selector: 'storage-checkbox' },
    placement: 'bottom',
    highlightPadding: 8,
  },
  {
    id: 'storage-mark-all',
    phase: 'storage',
    type: 'highlight',
    title: "Done with the fridge? Use ✓ All",
    body: "Tap \"✓ All\" to check off everything in a section at once — the section folds away so you can focus on what's left.",
    requiredTab: 'storage',
    target: 'storage-mark-all',
    placement: 'bottom',
    highlightPadding: 8,
  },

  // ─── Phase 3 · Pickup ────────────────────────────────────────
  {
    id: 'pickup-preview',
    phase: 'pickup',
    type: 'preview',
    title: 'Phase 3 — Track who picks up what',
    body: "Different co-ops show up at different times — Friday morning, Saturday noon, Sunday. Tap a time button to see only that window. Tap items off as each group leaves with theirs.",
    ctaText: 'Try it on the real app',
    previewScreen: ScreenPickupChips,
  },
  {
    id: 'pickup-chip',
    phase: 'pickup',
    type: 'interactive',
    title: 'Show only one time',
    body: "Tap \"Sunday\" to hide everything except Sunday pickups. Useful when you're working the Partner Group 7 shift.",
    hint: 'Tap "Sunday"',
    successMessage: 'Showing Sunday only.',
    requiredTab: 'pickup',
    target: 'pickup-chip-sunday',
    waitForAction: { type: 'click', selector: 'pickup-chip-sunday' },
    placement: 'bottom',
    highlightPadding: 8,
  },
  {
    id: 'pickup-destination',
    phase: 'pickup',
    type: 'highlight',
    title: 'Each pickup gets a card',
    body: "The card shows who's coming, when, and what they're getting. Tap items off as they head out the door. The 3/5 counter updates live, and \"Mark all picked up\" clears the card in one tap.",
    requiredTab: 'pickup',
    target: 'pickup-destination',
    placement: 'top',
    highlightPadding: 8,
  },

  // ─── Phase 4 · Inventory ─────────────────────────────────────
  {
    id: 'inventory-preview',
    phase: 'inventory',
    type: 'preview',
    title: 'Phase 4 — The pantry',
    body: "Inventory has three views: Browse what's on the shelves, Count how much is left, and Reorder builds next week's Food Bank order from what you counted. Tap the tabs to switch.",
    ctaText: 'Try it on the real app',
    previewScreen: ScreenInventoryBrowse,
  },
  {
    id: 'inventory-tab',
    phase: 'inventory',
    type: 'interactive',
    title: 'Open the Inventory tab',
    body: "The bottom tab bar is how you move between phases. Tap the Inventory tab to land in the pantry.",
    hint: 'Tap "Inventory"',
    successMessage: 'In the Inventory tab.',
    target: 'tab-inventory',
    waitForAction: { type: 'click', selector: 'tab-inventory' },
    placement: 'top',
    highlightPadding: 6,
  },
  {
    id: 'inventory-mode-count',
    phase: 'inventory',
    type: 'interactive',
    title: 'Count what\'s on the shelf',
    body: "Tap \"Count\" to update shelf totals with + and − buttons. Anything below its restock level shows a red \"LOW\" tag — those are what we'll order more of next week.",
    hint: 'Tap "Count"',
    successMessage: 'In Count mode now.',
    requiredTab: 'inventory',
    target: 'inventory-mode-count',
    waitForAction: { type: 'click', selector: 'inventory-mode-count' },
    placement: 'bottom',
    highlightPadding: 4,
    tightSpotlight: true,
  },
  {
    id: 'inventory-mode-reorder',
    phase: 'inventory',
    type: 'interactive',
    title: "Build next week's order",
    body: "Reorder takes everything you counted as LOW and suggests how much to ask Food Bank for next week. Tap \"Reorder\" to see the list.",
    hint: 'Tap "Reorder"',
    successMessage: 'Suggested order loaded.',
    requiredTab: 'inventory',
    target: 'inventory-mode-reorder',
    waitForAction: { type: 'click', selector: 'inventory-mode-reorder' },
    placement: 'bottom',
    highlightPadding: 4,
    tightSpotlight: true,
  },

  // ─── Power tools · Quick Actions / Door ──────────────────────
  {
    id: 'quick-actions-preview',
    phase: 'door-access',
    type: 'preview',
    title: 'Power tools live in the ⋮ menu',
    body: "The ⋮ icon up top opens everything else — door unlock, sharing this app via QR, switching your role, settings. The 🔐 next to it is a one-tap door unlock once you save your code.",
    ctaText: 'Open the real menu',
    previewScreen: ScreenQuickActions,
  },
  // Steps 16+17 used to be "Open menu" → "Look at door unlock" — Gemini v2
  // flagged the second beat as redundant. Consolidated: the user opens the
  // menu and the body covers what they're now looking at. The 🔐 header
  // shortcut is referenced in the body so it still gets airtime.
  {
    id: 'quick-actions-open',
    phase: 'door-access',
    type: 'interactive',
    title: 'Open the menu',
    body: "Tap the ⋮ icon. The sheet that opens has door unlock, the source spreadsheet, role switching, and settings — and the 🔐 right next to ⋮ is a one-tap shortcut once you save your code.",
    hint: 'Tap the ⋮ icon',
    successMessage: 'Quick Actions open. Look around — Door Unlock is at the top.',
    requiredTab: 'inventory',
    target: 'quick-actions-button',
    waitForAction: { type: 'click', selector: 'quick-actions-button' },
    placement: 'bottom',
    highlightPadding: 8,
    // Soak time so the user sees the open menu (specifically the Door Unlock
    // row at the top) before the completion modal whisks it away. Gemini v3
    // flagged this as the only true blocker — the menu was visible <400ms.
    postSuccessDelayMs: 2800,
  },

  // ─── Done ────────────────────────────────────────────────────
  {
    id: 'complete',
    phase: 'complete',
    type: 'modal',
    title: "You're ready.",
    body: "Thanks for volunteering. You can replay this any time from the ⋮ menu → Interactive tutorial. Now go feed people.",
    modalIcon: '🎉',
    ctaText: 'Start my shift',
  },
];
