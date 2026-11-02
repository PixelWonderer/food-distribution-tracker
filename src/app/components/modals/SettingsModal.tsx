import React from 'react';

import { PreferencesSheet } from './PreferencesSheet';

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Alias wrapper for the preferences sheet. Keeps the volunteer name editor
 * available for flows that expect a Settings modal component.
 */
export const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose }) => {
  return <PreferencesSheet open={open} onClose={onClose} />;
};
