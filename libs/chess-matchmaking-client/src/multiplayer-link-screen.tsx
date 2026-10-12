/**
 * What the multiplayer link opens to: multiplayer chess in the person's own
 * space, or why they cannot open another space.
 */

import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { Trans } from '@lingui/solid/macro';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { ScreenBase } from '@pkgs/ui-root-client/screen-base';
import { type JSX, Match, Switch } from 'solid-js';
import { useMultiplayerLinkOpening } from './use-multiplayer-link-opening';

export function MultiplayerLinkScreen(): JSX.Element {
  const opening = useMultiplayerLinkOpening();
  return (
    <ScreenBase
      screenId="chess-multiplayer-link"
      breadcrumbs={[{ name: <Trans>Multiplayer chess</Trans> }]}
      content={({ bodyClass }) => (
        <div class={bodyClass} data-testid="multiplayer-link-screen">
          <Switch fallback={<LoadingState />}>
            <Match
              when={(() => {
                const current = opening();
                return current.kind === 'spaceLimited' ? current : null;
              })()}
              keyed
            >
              {(limited) => <DenialSurface decision={limited.decision} />}
            </Match>
          </Switch>
        </div>
      )}
    />
  );
}
