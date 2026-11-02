import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type TabsRenderer = (() => React.ReactNode) | null;

type PickupTabsContextValue = {
  renderer: TabsRenderer;
  setRenderer: (renderer: TabsRenderer) => void;
};

const PickupTabsContext = createContext<PickupTabsContextValue | undefined>(undefined);

const useTabsContext = () => {
  const context = useContext(PickupTabsContext);
  if (!context) {
    throw new Error('Pickup tabs context accessed outside of provider.');
  }
  return context;
};

export const PickupTabsAnchorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [renderer, setRendererState] = useState<TabsRenderer>(null);

  const setRenderer = useCallback((next: TabsRenderer) => {
    setRendererState(() => next);
  }, []);

  const value = useMemo(
    () => ({
      renderer,
      setRenderer,
    }),
    [renderer, setRenderer]
  );

  return <PickupTabsContext.Provider value={value}>{children}</PickupTabsContext.Provider>;
};

export const usePickupTabsController = () => {
  const { setRenderer } = useTabsContext();
  return { setRenderer };
};

export const usePickupTabsRenderer = () => useTabsContext().renderer;
