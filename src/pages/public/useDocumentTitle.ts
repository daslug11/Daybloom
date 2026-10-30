import { useEffect } from 'react';

/** Sets the browser tab title for a page outside the app shell; resets it on leave. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
    return () => {
      document.title = 'Daybloom';
    };
  }, [title]);
}
