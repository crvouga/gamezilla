import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import type { JSX } from '@solidjs/web';
import { Match, Show, Switch } from 'solid-js';
import type { PuzzleShareState } from './puzzle-play-screen-model';

/**
 * What the share control says: the command, then how copying went. `short`
 * is for a button sharing its row with another (`Retry`), where the long
 * words would be cut.
 */
export function PuzzleShareLabel(props: {
  readonly state: PuzzleShareState;
  readonly short?: boolean | undefined;
}): JSX.Element {
  return (
    <Show
      when={props.short === true}
      fallback={
        <Switch fallback={<Trans>Share puzzle link</Trans>}>
          <Match when={props.state === 'copied'}>
            <Trans>Puzzle link copied</Trans>
          </Match>
          <Match when={props.state === 'failed'}>
            <Trans>Couldn't copy. Try again</Trans>
          </Match>
        </Switch>
      }
    >
      <Switch fallback={<Trans>Share</Trans>}>
        <Match when={props.state === 'copied'}>
          <Trans>Link copied</Trans>
        </Match>
        <Match when={props.state === 'failed'}>
          <Trans>Couldn't copy</Trans>
        </Match>
      </Switch>
    </Show>
  );
}
