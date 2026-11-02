import React from 'react';
import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';

import { ModalProvider } from '@/app/providers/ModalProvider';
import { AppShell } from '@/app/components/shell/AppShell';
import { resetAppStore, useAppStore } from '@/services/state';

const renderAppShell = (container: HTMLElement): Root => {
  let instance: Root | null = null;
  act(() => {
    const root = createRoot(container);
    instance = root;
    root.render(
      <ModalProvider>
        <AppShell />
      </ModalProvider>
    );
  });
  return instance as Root;
};

describe('AppShell smoke tests', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    resetAppStore();
    container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
    root = renderAppShell(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
  });

  it('renders the redesigned shell layout', () => {
    const shell = container.querySelector('[data-app-shell]');
    expect(shell).toBeTruthy();
    const header = container.querySelector('header');
    expect(header).toBeTruthy();
  });

  it('reflects confirmation item updates', () => {
    act(() => {
      useAppStore.setState({
        orderConfirmationItems: [
          {
            orderId: 'order-1',
            itemName: 'Strawberries',
            expectedQuantity: 3,
            receivedQuantity: null,
            isConfirmed: false,
            ranOut: false,
            unit: 'case',
            emoji: '🍓',
            storageType: 'Fridge',
            confirmedBy: null,
            confirmedAt: null,
            sheetRow: 1,
          },
        ],
        orderConfirmationStatus: {
          totalItems: 1,
          confirmedItems: 0,
          allConfirmed: false,
        },
      });
    });

    const itemTitle = container.querySelector('.leading-tight');
    expect(itemTitle?.textContent).toContain('Strawberries');
  });

  it('shows storage view when the tab changes', () => {
    act(() => {
      useAppStore.setState({ currentTab: 'storage' });
    });

    expect(container.textContent).toContain('Storage data is loading');
  });
});
