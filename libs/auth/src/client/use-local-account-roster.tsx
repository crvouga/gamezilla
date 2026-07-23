import { createContext, useContext, type ReactNode } from 'react';
import { useKvState } from '@pkgs/kv/use-kv-state';

import {
  LOCAL_ACCOUNT_ROSTER_KEY,
  localAccountRosterCodec,
} from './local-account-roster';
import type { LocalAccountRoster } from './local-account-roster-types';

type RosterTuple = [
  LocalAccountRoster,
  (
    next:
      | LocalAccountRoster
      | ((prev: LocalAccountRoster) => LocalAccountRoster)
  ) => void,
];

const LocalAccountRosterContext = createContext<RosterTuple | null>(null);

/**
 * Single shared roster state for the app. Without this, each
 * {@link useLocalAccountRoster} caller had isolated React state and only
 * synced via async Kv hydrate — account-switch remounts flashed `[]` and
 * wiped usernames when a sibling wrote `touch(prev=[])`.
 */
export function LocalAccountRosterProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const state = useKvState<LocalAccountRoster>({
    key: LOCAL_ACCOUNT_ROSTER_KEY,
    default: [],
    codec: localAccountRosterCodec,
  });
  return (
    <LocalAccountRosterContext.Provider value={state}>
      {children}
    </LocalAccountRosterContext.Provider>
  );
}

/** Reactive local multi-account roster (Kv-backed, shared via provider). */
export function useLocalAccountRoster(): [
  LocalAccountRoster,
  (
    next:
      | LocalAccountRoster
      | ((prev: LocalAccountRoster) => LocalAccountRoster)
  ) => void,
] {
  const ctx = useContext(LocalAccountRosterContext);
  if (ctx === null) {
    throw new Error(
      'useLocalAccountRoster: mount LocalAccountRosterProvider above this tree'
    );
  }
  return ctx;
}
