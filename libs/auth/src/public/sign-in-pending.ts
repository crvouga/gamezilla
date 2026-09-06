/**
 * Durable "sign-in in flight" marker. The OAuth redirect unloads the web page
 * (and may background the native app), so in-memory modal state is lost mid
 * flow. We persist a small JSON payload in secure storage when sign-in begins
 * and read it back on the next mount to resume the modal's loading state.
 *
 * Entries older than {@link SIGN_IN_PENDING_TTL_MS} are treated as stale (the
 * user abandoned the flow long ago) so a forgotten marker never spuriously
 * re-opens the modal on a cold start.
 */

import { useClock } from '@pkgs/clock/solid';
import { createSecureStorageItem } from '@pkgs/secure-storage/solid';
import type { Accessor } from 'solid-js';
import { createMemo } from 'solid-js';
import { SIGN_IN_PENDING_KEY } from './auth-storage-keys';
import {
  parseSignInPending,
  type SignInPending,
} from './sign-in-pending-parse';

export * from './sign-in-pending-parse';

/**
 * Reactive view of the pending marker for the modal provider. `pending` is the
 * parsed (non-stale) payload; `isHydrated` is `true` once the initial async
 * read completes so callers can avoid acting on an unknown value.
 */
export function useSignInPending(): {
  pending: Accessor<SignInPending | null>;
  isHydrated: Accessor<boolean>;
} {
  const clock = useClock();
  const item = createSecureStorageItem(SIGN_IN_PENDING_KEY);
  const pending = createMemo(() =>
    parseSignInPending(item.value(), () => clock.now())
  );
  return { pending, isHydrated: item.isHydrated };
}
