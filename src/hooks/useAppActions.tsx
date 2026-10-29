import { createContext, useContext } from 'react';

export type CaptureMode = 'note' | 'task';

export interface AppActions {
  openCapture: (opts?: { mode?: CaptureMode; text?: string; voice?: boolean }) => void;
  openAtlas: (prefill?: string) => void;
  openVoice: () => void;
  openPalette: () => void;
  startTour: () => void;
}

export const AppActionsContext = createContext<AppActions | null>(null);

export function useAppActions() {
  const ctx = useContext(AppActionsContext);
  if (!ctx) throw new Error('useAppActions must be used inside the app shell');
  return ctx;
}
