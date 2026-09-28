/**
 * Tabs vs columns preference for multi-client product-harness / tests chrome.
 * Session-local state shared via context across layout consumers.
 */

import { createContext, createSignal, type JSX, useContext } from 'solid-js';

import type { ClientLayoutMode } from './layout';

type ClientLayoutPreferenceValue = {
  readonly preference: ClientLayoutMode;
  readonly setPreference: (mode: ClientLayoutMode) => void;
};

const ClientLayoutPreferenceContext =
  createContext<ClientLayoutPreferenceValue | null>(null);

export function ClientLayoutPreferenceProvider(props: {
  readonly children: JSX.Element;
  readonly defaultPreference?: ClientLayoutMode;
}): JSX.Element {
  const [preference, setPreferenceState] = createSignal<ClientLayoutMode>(
    props.defaultPreference ?? 'columns'
  );
  const setPreference = (mode: ClientLayoutMode) => {
    setPreferenceState(mode);
  };
  const value: ClientLayoutPreferenceValue = {
    get preference() {
      return preference();
    },
    setPreference,
  };
  return (
    <ClientLayoutPreferenceContext.Provider value={value}>
      {props.children}
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
