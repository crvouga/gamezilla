import type { MultiplayerRatingPool } from '@libs/game-matchmaking-shared-ts/time-control';
import { Trans } from '@lingui/solid/macro';
import { type JSX, Match, Switch } from 'solid-js';

export function SpeedName(props: { readonly speed: string }): JSX.Element {
  return (
    <Switch>
      <Match when={props.speed === ('bullet' satisfies MultiplayerRatingPool)}>
        <Trans>Bullet</Trans>
      </Match>
      <Match when={props.speed === ('blitz' satisfies MultiplayerRatingPool)}>
        <Trans>Blitz</Trans>
      </Match>
      <Match when={props.speed === ('rapid' satisfies MultiplayerRatingPool)}>
        <Trans>Rapid</Trans>
      </Match>
      <Match
        when={props.speed === ('classical' satisfies MultiplayerRatingPool)}
      >
        <Trans>Classical</Trans>
      </Match>
      <Match when={props.speed === ('daily' satisfies MultiplayerRatingPool)}>
        <Trans>Daily</Trans>
      </Match>
    </Switch>
  );
}
