import type { PuzzleStatusKind } from '@libs/game-puzzle-shared-ts/status-kind';
import {
  ChevronsRightIcon,
  ClockIcon,
  SearchIcon,
  WifiOffIcon,
  XIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { VictoryArt } from '@pkgs/ui-root-client-ts/illustration';
import { Spinner } from '@pkgs/ui-root-client-ts/spinner';
import type { JSX } from '@solidjs/web';
import { Match, Switch } from 'solid-js';

const ICON_SIZE = 20;

/**
 * The glyph for one status, leading the status row. The solver's own turn
 * has none: its prompt says it in words, and a play-shaped mark beside it
 * read as a button.
 */
export function PuzzleStatusIcon(props: {
  kind: PuzzleStatusKind;
}): JSX.Element {
  const kind = (): PuzzleStatusKind => props.kind;
  return (
    <Switch>
      <Match when={kind() === 'loading'}>
        <Spinner size="sm" />
      </Match>
      <Match when={kind() === 'empty' || kind() === 'limited'}>
        <SearchIcon size={ICON_SIZE} color="textSecondary" />
      </Match>
      <Match when={kind() === 'offline'}>
        <WifiOffIcon size={ICON_SIZE} color="textSecondary" />
      </Match>
      <Match when={kind() === 'waiting'}>
        <ClockIcon size={ICON_SIZE} color="textSecondary" />
      </Match>
      <Match when={kind() === 'solved'}>
        <VictoryArt />
      </Match>
      <Match when={kind() === 'failed'}>
        <XIcon size={ICON_SIZE} color="destructive" />
      </Match>
      <Match when={kind() === 'skipped'}>
        <ChevronsRightIcon size={ICON_SIZE} color="textSecondary" />
      </Match>
    </Switch>
  );
}
