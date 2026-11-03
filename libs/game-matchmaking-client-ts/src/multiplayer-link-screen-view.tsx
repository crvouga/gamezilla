import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { type JSX, Match, Show, Switch } from 'solid-js';

/**
 * Where opening the link stands: going to the person's space, stopped at
 * the hosting limit (`denial`), failed or stalled, or a link to a game that
 * offers no matchmaking.
 */
export type MultiplayerLinkStatus =
  | 'opening'
  | 'limited'
  | 'failed'
  | 'unavailable';

export type MultiplayerLinkScreenViewProps = {
  readonly status: MultiplayerLinkStatus;
  /** Why the person cannot open another space, while `limited`. */
  readonly denial?: DenialView | undefined;
  readonly onRetry: () => void;
  readonly onGoToSpaces: () => void;
};

function Opening(props: MultiplayerLinkScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <ContentScreen
      screenId="multiplayer-link"
      breadcrumbs={[{ name: <Trans>Multiplayer</Trans> }]}
      dataSet={{ testid: 'multiplayer-link-screen' }}
    >
      <Switch fallback={<LoadingState />}>
        <Match when={props.status === 'limited' ? props.denial : undefined}>
          {(denial) => <DenialSurfaceView denial={denial()} />}
        </Match>
        <Match when={props.status === 'failed'}>
          <ErrorState
            title={t`Couldn’t open multiplayer`}
            body={t`Your space didn’t open this time. Nothing you had is lost. Try again, or go to Spaces.`}
            retry={{
              label: t`Try again`,
              onClick: () => props.onRetry(),
              dataSet: { testid: 'multiplayer-link-retry' },
            }}
            secondary={{
              label: t`Go to Spaces`,
              onClick: () => props.onGoToSpaces(),
            }}
            dataSet={{ testid: 'multiplayer-link-failed' }}
          />
        </Match>
      </Switch>
    </ContentScreen>
  );
}

/**
 * What a game's multiplayer link opens to, presentational: going to the
 * person's own space, why they cannot open another, a way to try again or
 * go to Spaces when opening failed, or an out-of-date link.
 */
export function MultiplayerLinkScreenView(
  props: MultiplayerLinkScreenViewProps
): JSX.Element {
  return (
    <Show
      when={props.status === 'unavailable'}
      fallback={<Opening {...props} />}
    >
      <ContentScreen screenId="multiplayer-link-unavailable" breadcrumbs={[]}>
        <ErrorState
          title={<Trans>This game is unavailable.</Trans>}
          body={
            <Trans>
              The link may be out of date. Pick a game from your list.
            </Trans>
          }
        />
      </ContentScreen>
    </Show>
  );
}
