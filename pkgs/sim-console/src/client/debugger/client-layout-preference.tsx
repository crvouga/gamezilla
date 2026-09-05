/**
 * Tabs vs columns preference for multi-client playground / reports chrome.
 * Session-local React state (shared via context across layout consumers).
 */

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import type { ClientLayoutMode } from './sim-console-layout';

type ClientLayoutPreferenceValue = {
  readonly preference: ClientLayoutMode;
  readonly setPreference: (mode: ClientLayoutMode) => void;
};

const ClientLayoutPreferenceContext =
  createContext<ClientLayoutPreferenceValue | null>(null);

export function ClientLayoutPreferenceProvider(props: {
  readonly children: ReactNode;
  readonly defaultPreference?: ClientLayoutMode;
}): ReactNode {
  const { children, defaultPreference = 'columns' } = props;
  const [preference, setPreferenceState] =
    useState<ClientLayoutMode>(defaultPreference);
  const setPreference = useCallback((mode: ClientLayoutMode) => {
    setPreferenceState(mode);
  }, []);
  const value = useMemo(
    (): ClientLayoutPreferenceValue => ({ preference, setPreference }),
    [preference, setPreference]
  );
  return (
    <ClientLayoutPreferenceContext.Provider value={value}>
      {children}
    </ClientLayoutPreferenceContext.Provider>
  );
}

export function useClientLayoutPreference(): ClientLayoutPreferenceValue {
  const ctx = useContext(ClientLayoutPreferenceContext);
  if (ctx === null) {
    throw new Error(
      'useClientLayoutPreference must be used within ClientLayoutPreferenceProvider'
    );
  }
  return ctx;
}
