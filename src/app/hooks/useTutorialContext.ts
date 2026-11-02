import { useContext } from 'react';

import { TutorialContext, type TutorialContextValue } from '@/app/providers/TutorialContext';

export const useTutorialContext = (): TutorialContextValue => {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error('useTutorialContext must be used within a TutorialProvider');
  }
  return ctx;
};
