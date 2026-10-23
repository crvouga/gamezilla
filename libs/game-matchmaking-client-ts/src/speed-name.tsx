import type { MultiplayerSpeed } from '@libs/game-matchmaking-shared-ts/time-control';
import { Trans } from '@lingui/solid/macro';
import { type JSX, Match, Switch } from 'solid-js';

export function SpeedName(props: { readonly speed: string }): JSX.Element {
  return (
    <Switch>
      <Match when={props.speed === ('bullet' satisfies MultiplayerSpeed)}>
        <Trans>Bullet</Trans>
      </Match>
      <Match when={props.speed === ('blitz' satisfies MultiplayerSpeed)}>
        <Trans>Blitz</Trans>
      </Match>
      <Match when={props.speed === ('rapid' satisfies MultiplayerSpeed)}>
        <Trans>Rapid</Trans>
      </Match>
      <Match when={props.speed === ('classical' satisfies MultiplayerSpeed)}>
        <Trans>Classical</Trans>
      </Match>
      <Match when={props.speed === ('daily' satisfies MultiplayerSpeed)}>
        <Trans>Daily</Trans>
      </Match>
    </Switch>
  );
}
