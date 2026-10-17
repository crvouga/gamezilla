/**
 * What the multiplayer link opens to: multiplayer game in the person's own
 * space, or why they cannot open another space.
 */

import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { Trans } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client/content-screen';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { type JSX, Match, Switch } from 'solid-js';
import { useMultiplayerLinkOpening } from './use-multiplayer-link-opening';

export function MultiplayerLinkScreen(props: { gameId: string }): JSX.Element {
  const opening = useMultiplayerLinkOpening(props.gameId);
  return (
    <ContentScreen
      screenId="multiplayer-link"
      breadcrumbs={[{ name: <Trans>Multiplayer</Trans> }]}
      dataSet={{ testid: 'multiplayer-link-screen' }}
    >
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
    </ContentScreen>
  );
}
