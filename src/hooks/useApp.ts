import { createContext, useContext } from 'react';
import type { PageId } from '../lib/types';

export interface AppActions {
  navigate: (page: PageId) => void;
  openPalette: () => void;
  openSettings: () => void;
  /** Ask the Calendars page to open its "Add calendar" modal. */
  requestAddCalendar: () => void;
  addCalendarRequested: number;
}

export const AppContext = createContext<AppActions | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <App>');
  return ctx;
}
