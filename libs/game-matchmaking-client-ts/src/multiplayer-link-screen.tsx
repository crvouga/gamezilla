/**
 * What the multiplayer link opens to: multiplayer game in the person's own
 * space, why they cannot open another space, or — when opening failed or
 * stalled — a way to try again or go to Spaces.
 */

import { useDenialView } from '@libs/permissions-client-ts/denial-surface';
import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import type { JSX } from 'solid-js';
import { MultiplayerLinkScreenView } from './multiplayer-link-screen-view';
import { useMultiplayerLinkOpening } from './use-multiplayer-link-opening';

/** A placeholder for "no hosting limit", which resolves to nothing shown. */
const ALLOWED: Decision = { allowed: true, policyVersion: '' };

/** `/multiplayer/:gameId`: wires `MultiplayerLinkScreenView` to opening the link. */
export function MultiplayerLinkScreen(props: { gameId: string }): JSX.Element {
  const router = useRouter();
  const link = useMultiplayerLinkOpening(props.gameId);
  const limited = (): Decision | null => {
    const current = link.opening();
    return current.kind === 'spaceLimited' ? current.decision : null;
  };
  const denial = useDenialView({
    get decision() {
      return limited() ?? ALLOWED;
    },
  });
  return (
    <MultiplayerLinkScreenView
      status={
        limited() !== null
          ? 'limited'
          : link.opening().kind === 'failed'
            ? 'failed'
            : 'opening'
      }
      denial={limited() === null ? undefined : denial()}
      onRetry={link.retry}
      onGoToSpaces={() => router.replace('/')}
    />
  );
}
