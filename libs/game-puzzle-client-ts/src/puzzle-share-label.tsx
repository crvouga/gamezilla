import { Trans } from '@lingui/solid/macro';
import { type JSX, Match, Switch } from 'solid-js';
import type { PuzzleShareState } from './puzzle-play-screen-model';

/** What the share control says: the command, then how copying went. */
export function PuzzleShareLabel(props: {
  readonly state: PuzzleShareState;
}): JSX.Element {
  return (
    <Switch fallback={<Trans>Share puzzle link</Trans>}>
      <Match when={props.state === 'copied'}>
        <Trans>Puzzle link copied</Trans>
      </Match>
      <Match when={props.state === 'failed'}>
        <Trans>Couldn't copy. Try again</Trans>
      </Match>
    </Switch>
  );
}
