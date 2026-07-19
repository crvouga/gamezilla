import { useKvState } from '@pkgs/kv/use-kv-state';

import {
  LOCAL_ACCOUNT_ROSTER_KEY,
  localAccountRosterCodec,
} from './local-account-roster';
import type { LocalAccountRoster } from './local-account-roster-types';

/** Reactive local multi-account roster (Kv-backed). */
export function useLocalAccountRoster(): [
  LocalAccountRoster,
  (
    next:
      | LocalAccountRoster
      | ((prev: LocalAccountRoster) => LocalAccountRoster)
  ) => void,
] {
  return useKvState<LocalAccountRoster>({
    key: LOCAL_ACCOUNT_ROSTER_KEY,
    default: [],
    codec: localAccountRosterCodec,
  });
}
