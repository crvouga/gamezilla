import type { PuzzleStatusKind } from '@libs/game-puzzle-shared/status-kind';
import { Trans } from '@lingui/solid/macro';
import { Badge, type BadgeIntent } from '@pkgs/ui-root-client/badge';
import {
  ClockIcon,
  PlayIcon,
  SearchIcon,
  WifiOffIcon,
} from '@pkgs/ui-root-client/icons';
import { Spinner } from '@pkgs/ui-root-client/spinner';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import type { JSX } from 'solid-js';
import { Match, Switch } from 'solid-js';

const ICON_SIZE = 18;

type MarkKind = 'failed' | 'solved' | 'skipped';

/** Failed is the destructive fill, solved the warning star, skipped quiet. */
const MARK_INTENT: Readonly<Record<MarkKind, BadgeIntent>> = {
  failed: 'destructive',
  solved: 'warning',
  skipped: 'neutral',
};

function StatusMark(props: { kind: MarkKind }): JSX.Element {
  // The badge sets itself at the start of its row; its own column centers
  // it on the status line instead.
  return (
    <StackVertical>
      <Badge
        size="sm"
        intent={MARK_INTENT[props.kind]}
        tone={props.kind === 'skipped' ? 'subtle' : 'solid'}
        label={
          <Switch
            fallback={<Trans id="chess.puzzleStatus.skippedMark">»</Trans>}
          >
            <Match when={props.kind === 'failed'}>
              <Trans id="chess.puzzleStatus.failedMark">✕</Trans>
            </Match>
            <Match when={props.kind === 'solved'}>
              <Trans id="chess.puzzleStatus.solvedMark">★</Trans>
            </Match>
          </Switch>
        }
      />
    </StackVertical>
  );
}

function markKind(kind: PuzzleStatusKind): MarkKind | null {
  return kind === 'failed' || kind === 'solved' || kind === 'skipped'
    ? kind
    : null;
}

/** The glyph for one status, leading the status row. */
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
      <Match when={kind() === 'started'}>
        <PlayIcon size={ICON_SIZE} color="textSecondary" />
      </Match>
      <Match when={markKind(kind())}>
        {(mark) => <StatusMark kind={mark()} />}
      </Match>
    </Switch>
  );
}
