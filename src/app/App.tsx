import React from 'react';
import { AppShell } from './components/shell/AppShell';
import { AppBootstrap } from './providers/AppBootstrap';
import { ModalProvider } from './providers/ModalProvider';
import { TutorialProvider } from './providers/TutorialProvider';

export const App: React.FC = () => {
  return (
    <AppBootstrap>
      <TutorialProvider>
        <ModalProvider>
          <AppShell />
        </ModalProvider>
      </TutorialProvider>
    </AppBootstrap>
  );
};
