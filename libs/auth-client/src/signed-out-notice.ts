/** The live "you were signed out on this device" notice, if any. */

import { SIGNED_OUT_NOTICE_KEY } from '@libs/auth-shared/auth-storage-keys';
import {
  parseSignedOutNotice,
  type SignedOutNotice,
} from '@libs/auth-shared/signed-out-notice';
import { createSecureStorageItem } from '@pkgs/secure-storage-root-client/solid';
import { type Accessor, createMemo } from 'solid-js';

/** The notice to show, if any, and the way to dismiss it. */
export function useSignedOutNotice(): {
  readonly notice: Accessor<SignedOutNotice | null>;
  readonly dismiss: () => Promise<void>;
} {
  const item = createSecureStorageItem(SIGNED_OUT_NOTICE_KEY);
  const notice = createMemo(() => parseSignedOutNotice(item.value()));
  return { notice, dismiss: () => item.setValue(null) };
}
