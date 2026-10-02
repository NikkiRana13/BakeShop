import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createSeedState,
  STATE_VERSION,
  withNewFieldDefaults,
} from '../data/seed';
import { AppState, Result } from '../types';

const STORAGE_KEY = 'grandmas-order-desk/state';

interface StoreValue {
  state: AppState;
  /**
   * Applies a pure transition against the latest state. Returns the error
   * message on failure, or null on success.
   */
  run: (fn: (s: AppState) => Result) => string | null;
  resetDemo: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [state, setState] = useState<AppState | null>(null);
  const stateRef = useRef<AppState | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let loaded: AppState | null = null;
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as AppState) : null;
        if (parsed && parsed.version === STATE_VERSION) {
          loaded = withNewFieldDefaults(parsed);
        }
      } catch {
        loaded = null;
      }
      if (!cancelled) {
        const next = loaded ?? createSeedState();
        stateRef.current = next;
        setState(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
    }
  }, [state]);

  const run = useCallback((fn: (s: AppState) => Result) => {
    const current = stateRef.current;
    if (!current) {
      return 'Still loading. Please try again.';
    }
    const result = fn(current);
    if (!result.ok) {
      return result.error;
    }
    // Update the ref synchronously so a quick double tap validates against
    // the new state and cannot deduct stock twice.
    stateRef.current = result.state;
    setState(result.state);
    return null;
  }, []);

  const resetDemo = useCallback(() => {
    const next = createSeedState();
    stateRef.current = next;
    setState(next);
  }, []);

  const value = useMemo(
    () => (state ? { state, run, resetDemo } : null),
    [state, run, resetDemo],
  );

  if (!value) {
    return <>{fallback ?? null}</>;
  }
  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore must be used inside StoreProvider');
  }
  return ctx;
}
