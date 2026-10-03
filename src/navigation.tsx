import { createContext, useContext } from 'react';

export type TabName = 'home' | 'inventory' | 'sales';

/** One-off requests passed along with a tab switch (e.g. open the batch form). */
export type Intent =
  | { kind: 'batch'; treatId?: string; servings?: number }
  | { kind: 'shop'; treatId?: string; servings?: number }
  | { kind: 'closing'; day: string };

export interface Nav {
  tab: TabName;
  intent: (Intent & { id: number }) | null;
  go: (tab: TabName, intent?: Intent) => void;
  clearIntent: () => void;
}

export const NavContext = createContext<Nav | null>(null);

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) {
    throw new Error('useNav must be used inside NavContext');
  }
  return nav;
}
