import { Trans } from '@lingui/solid/macro';
import { type JSX, Match, Switch } from 'solid-js';
import type { PuzzleShareState } from './puzzle-play-screen-model';

/**
 * What the share control says: the command, then how copying went.
 * `short`: a command among others on one line (the result's dock) says it
 * in a word or two.
 */
export function PuzzleShareLabel(props: {
  readonly state: PuzzleShareState;
  readonly short?: boolean | undefined;
}): JSX.Element {
  return (
    <Switch
      fallback={
        props.short === true ? (
          <Trans>Share</Trans>
        ) : (
          <Trans>Share puzzle link</Trans>
        )
      }
    >
      <Match when={props.state === 'copied'}>
        {props.short === true ? (
          <Trans>Link copied</Trans>
        ) : (
          <Trans>Puzzle link copied</Trans>
        )}
      </Match>
      <Match when={props.state === 'failed'}>
        {/* Among other commands it keeps its name: the reason is said
            beside the commands. */}
        {props.short === true ? (
          <Trans>Share</Trans>
        ) : (
          <Trans>Couldn't copy. Try again</Trans>
        )}
      </Match>
    </Switch>
  );
}
