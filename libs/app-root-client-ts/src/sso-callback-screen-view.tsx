/** @jsxImportSource @solidjs/web */

import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from '@solidjs/web';

/**
 * `/sso-callback`, presentational: the one state a person sees while a hosted
 * sign-in redirect completes — a centered "Signing in…" indicator. The route
 * finishes the redirect and leaves for where sign-in started.
 */
export function SsoCallbackScreenView(): JSX.Element {
  return (
    <StackVertical grow align="center" justify="center">
      <LoadingState caption={<Trans>Signing in…</Trans>} />
    </StackVertical>
  );
}
