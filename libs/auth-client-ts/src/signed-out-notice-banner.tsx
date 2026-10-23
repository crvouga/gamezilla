/** @jsxImportSource solid-js */
/**
 * Top banner after this device's sign-in ended without the person asking
 * here: signed out everywhere from another device, or lapsed. It says so,
 * says when changes made here had not been shared and were not kept, and
 * offers to sign in again. Mount under `AuthModalsProvider`.
 */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { DismissibleBanner } from '@pkgs/ui-root-client-ts/dismissible-top-banner';
import { type JSX, Show } from 'solid-js';
import { useSignInModal } from './auth-modals-provider';
import { useSignedOutNotice } from './signed-out-notice';

export function SignedOutNoticeBanner(): JSX.Element {
  const { t } = useLingui();
  const { notice, dismiss } = useSignedOutNotice();
  const { open: openSignIn } = useSignInModal();
  const unshared = (): number => notice()?.unshared ?? 0;
  return (
    <DismissibleBanner
      visible={notice() !== null}
      onDismiss={() => void dismiss()}
      position="top"
      tone="warning"
      title={t`You were signed out on this device`}
      subtitle={
        <Show
          when={unshared() > 0}
          fallback={
            <Trans>
              Your sign-in here ended, from another device or because it ran
              out. Sign in again to carry on.
            </Trans>
          }
        >
          <Trans>
            Your sign-in here ended, from another device or because it ran out.
            Changes made here that had not been shared yet were not kept.
          </Trans>
        </Show>
      }
      actionLabel={t`Sign in`}
      onActionClick={openSignIn}
      actionDataSet={{ testid: Handles.signedOutNoticeSignIn }}
      dataSet={{
        testid: Handles.signedOutNotice,
        unshared: unshared() > 0 ? 'not-kept' : 'none',
      }}
    />
  );
}
