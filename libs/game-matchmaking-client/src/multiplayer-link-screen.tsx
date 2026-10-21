/**
 * What the multiplayer link opens to: multiplayer game in the person's own
 * space, why they cannot open another space, or — when opening failed or
 * stalled — a way to try again or go to Spaces.
 */

import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client/app-router';
import { ContentScreen } from '@pkgs/ui-root-client/content-screen';
import { ErrorState } from '@pkgs/ui-root-client/error-state';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { type JSX, Match, Switch } from 'solid-js';
import { useMultiplayerLinkOpening } from './use-multiplayer-link-opening';

export function MultiplayerLinkScreen(props: { gameId: string }): JSX.Element {
  const { t } = useLingui();
  const router = useRouter();
  const link = useMultiplayerLinkOpening(props.gameId);
  return (
    <ContentScreen
      screenId="multiplayer-link"
      breadcrumbs={[{ name: <Trans>Multiplayer</Trans> }]}
      dataSet={{ testid: 'multiplayer-link-screen' }}
    >
      <Switch fallback={<LoadingState />}>
        <Match
          when={(() => {
            const current = link.opening();
            return current.kind === 'spaceLimited' ? current : null;
          })()}
          keyed
        >
          {(limited) => <DenialSurface decision={limited.decision} />}
        </Match>
        <Match when={link.opening().kind === 'failed'}>
          <ErrorState
            title={t`Couldn’t open multiplayer`}
            body={t`Your space didn’t open this time. Nothing you had is lost. Try again, or go to Spaces.`}
            retry={{
              label: t`Try again`,
              onClick: link.retry,
              dataSet: { testid: 'multiplayer-link-retry' },
            }}
            secondary={{
              label: t`Go to Spaces`,
              onClick: () => router.replace('/'),
            }}
            dataSet={{ testid: 'multiplayer-link-failed' }}
          />
        </Match>
      </Switch>
    </ContentScreen>
  );
}
