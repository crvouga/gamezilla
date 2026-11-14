import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import {
  GameMoveList,
  type GameMoveListEntry,
} from '@pkgs/ui-root-client-ts/game-move-list';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import {
  type GameSeatLook,
  GameSeatSwatch,
} from '@pkgs/ui-root-client-ts/game-seat-swatch';
import { GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { GameTurnPill } from '@pkgs/ui-root-client-ts/game-turn-pill';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { KeyHints } from '@pkgs/ui-root-client-ts/key-hints';
import { useRelativeTimeLabel } from '@pkgs/ui-root-client-ts/relative-time';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { useDocumentShortcuts } from '@pkgs/ui-root-client-ts/use-document-shortcuts';
import { useHoverCapable } from '@pkgs/ui-root-client-ts/use-hover-capable';
import { createMemo, For, type JSX, Show } from 'solid-js';
import type { FramePeople } from './game-frame-view-types';
import {
  type GameHistoryOutcome,
  type GameHistoryPlayer,
  HistoryPlayers,
} from './game-history-screen-view';

/** One player of the replayed game, with the seat they played. */
export type GameReplayPlayer = GameHistoryPlayer & {
  /** The seat's name in the game ("Red circle"). */
  readonly sideLabel: string;
  readonly swatch?: GameSeatLook | undefined;
  /** The result went to this player's seat. */
  readonly winner: boolean;
  /** The viewer. */
  readonly you: boolean;
};

/** One played move, as the game writes it, and the seat that made it. */
export type GameReplayMove = {
  readonly label: string;
  readonly sideLabel?: string | undefined;
  readonly swatch?: GameSeatLook | undefined;
};

export type GameReplayScreenViewProps = {
  /** Everyone who played, in seat order. */
  readonly players: readonly GameReplayPlayer[];
  /** The viewer's result; `null` when they did not play. */
  readonly outcome: GameHistoryOutcome | null;
  /** How the game ended, in words, said to the viewer ("You won by four in a row."). */
  readonly result: string;
  /** When it ended, as an ISO instant; `null` when unknown. */
  readonly endedAt: string | null;
  /** The position shown: 0 is the start, `moves.length` the end. */
  readonly ply: number;
  readonly moves: readonly GameReplayMove[];
  /** Moves per numbered turn: the seats in rotation; 1 numbers every move. */
  readonly perTurn: number;
  /** The word that names bare-number moves once (`Column`); `''` for none. */
  readonly moveHeading: string;
  /** The position shown, for automated observers. */
  readonly position: string;
  /** The game's own board, read-only, at `position`. */
  readonly board: JSX.Element;
  readonly people?: FramePeople | undefined;
  /** Show the position after `ply` moves. */
  readonly onSeek: (ply: number) => void;
  /** Back to the list of finished games. */
  readonly onBack: () => void;
};

/** A step through the moves is a full touch target. */
const STEP_SIZE = 44;
const STEP_PLATE = 'surfaceMuted';

/** Which position the board shows, in words; never the game's result. */
function ShownPosition(props: GameReplayScreenViewProps): JSX.Element {
  const last = () => props.moves.length;
  return (
    <GameTurnPill
      live
      tone="neutral"
      dataSet={{
        testid: 'game-history-review-move',
        'shown-position': props.position,
        ply: String(props.ply),
      }}
      title={
        <Show when={last() > 0} fallback={<Trans>No moves were played</Trans>}>
          <Show
            when={props.ply > 0}
            fallback={<Trans>Starting position</Trans>}
          >
            <Show
              when={props.ply < last()}
              fallback={
                <Trans>
                  Final position, move {props.ply} of {last()}
                </Trans>
              }
            >
              <Trans>
                After move {props.ply} of {last()}
              </Trans>
            </Show>
          </Show>
        </Show>
      }
    />
  );
}

/** The four steps through the moves, and the arrow keys that take them. */
function ReplaySteps(props: GameReplayScreenViewProps): JSX.Element {
  const last = () => props.moves.length;
  const seek = (ply: number): boolean => {
    const next = Math.min(last(), Math.max(0, ply));
    if (next === props.ply) return false;
    props.onSeek(next);
    return true;
  };
  useDocumentShortcuts({
    enabled: () => last() > 0,
    onKeyDown: (event) => {
      if (event.key === 'ArrowLeft') return seek(props.ply - 1);
      if (event.key === 'ArrowRight') return seek(props.ply + 1);
      if (event.key === 'Home') return seek(0);
      if (event.key === 'End') return seek(last());
      return undefined;
    },
  });
  const keyboard = useHoverCapable();
  return (
    <Show when={last() > 0}>
      <StackVertical gap="xs" align="center">
        <StackHorizontal
          gap="sm"
          align="center"
          justify="center"
          testId="game-history-review-steps"
        >
          <IconButton
            label={t`Go to the start`}
            size={STEP_SIZE}
            background={STEP_PLATE}
            disabled={props.ply === 0}
            onClick={() => seek(0)}
            dataSet={{ testid: 'game-history-review-first' }}
          >
            <ChevronsLeftIcon />
          </IconButton>
          <IconButton
            label={t`Previous move`}
            size={STEP_SIZE}
            background={STEP_PLATE}
            disabled={props.ply === 0}
            onClick={() => seek(props.ply - 1)}
            dataSet={{ testid: 'game-history-review-back' }}
          >
            <ChevronLeftIcon />
          </IconButton>
          <IconButton
            label={t`Next move`}
            size={STEP_SIZE}
            background={STEP_PLATE}
            disabled={props.ply === last()}
            onClick={() => seek(props.ply + 1)}
            dataSet={{ testid: 'game-history-review-forward' }}
          >
            <ChevronRightIcon />
          </IconButton>
          <IconButton
            label={t`Go to the final position`}
            size={STEP_SIZE}
            background={STEP_PLATE}
            disabled={props.ply === last()}
            onClick={() => seek(last())}
            dataSet={{ testid: 'game-history-review-last' }}
          >
            <ChevronsRightIcon />
          </IconButton>
        </StackHorizontal>
        <Show when={keyboard()}>
          <KeyHints
            hints={[
              { keys: ['←', '→'], label: t`step` },
              { keys: ['Home', 'End'], label: t`start or end` },
            ]}
          />
        </Show>
      </StackVertical>
    </Show>
  );
}

/** Each player beside their seat's colour, the winner marked in words. */
function ReplayPlayers(props: GameReplayScreenViewProps): JSX.Element {
  return (
    <GameSection title={<Trans>Players</Trans>}>
      <StackVertical gap="sm" testId="game-history-review-players">
        <For each={props.players}>
          {(player) => (
            <StackHorizontal align="center" justify="between" gap="sm">
              <StackHorizontal align="center" gap="sm">
                <Show when={player.swatch}>
                  {(look) => (
                    <GameSeatSwatch look={look()} label={player.sideLabel} />
                  )}
                </Show>
                <P variant="label">
                  <HistoryPlayers
                    players={[player]}
                    played={false}
                    people={props.people}
                  />
                  <Show when={player.you}>
                    {' '}
                    <Trans>(you)</Trans>
                  </Show>
                </P>
              </StackHorizontal>
              <Show
                when={player.winner && props.players.some((p) => !p.winner)}
              >
                <Badge
                  size="sm"
                  intent="success"
                  label={<Trans>Winner</Trans>}
                />
              </Show>
            </StackHorizontal>
          )}
        </For>
      </StackVertical>
    </GameSection>
  );
}

/** Every move, numbered by turn; pressing one shows the board after it. */
function ReplayMoves(props: GameReplayScreenViewProps): JSX.Element {
  const entries = createMemo((): readonly GameMoveListEntry[] =>
    props.moves.map((move, index) => ({
      ply: index + 1,
      label: move.label,
      swatch: move.swatch,
      accessibleName:
        move.sideLabel === undefined
          ? t`Move ${index + 1}: ${move.label}`
          : t`Move ${index + 1}, ${move.sideLabel}: ${move.label}`,
      testId: `game-history-review-move-${String(index + 1)}`,
    }))
  );
  return (
    <GameSection title={<Trans>Moves</Trans>} fill>
      <Show
        when={props.moves.length > 0}
        fallback={
          <P variant="caption" tone="secondary">
            <Trans>The game ended before anyone moved.</Trans>
          </P>
        }
      >
        <GameMoveList
          layout="table"
          aria-label={t`Moves played`}
          perTurn={props.perTurn}
          current={props.ply}
          moves={entries()}
          onSelect={props.onSeek}
          heading={props.moveHeading || undefined}
          turnLabel={(turn) => <Trans>Move {turn}</Trans>}
          wrap
          ended
        />
      </Show>
    </GameSection>
  );
}

/** "You won by four in a row. · 2d ago" */
function ReplaySubtitle(props: GameReplayScreenViewProps): JSX.Element {
  const ago = useRelativeTimeLabel(() => props.endedAt ?? '');
  return (
    <>
      {props.result}
      <Show when={props.endedAt !== null}> · {ago()}</Show>
    </>
  );
}

/**
 * Replaying one finished game from History and stats, presentational: who
 * played and how it ended above the game's own board (`board`), the
 * position shown in words under it, the four steps (and the arrow keys),
 * and every move to jump to.
 */
export function GameReplayScreenView(
  props: GameReplayScreenViewProps
): JSX.Element {
  const opponents = createMemo(() =>
    props.outcome === null
      ? props.players
      : props.players.filter((player) => !player.you)
  );
  return (
    <GameScreen
      screenId="game-history-review"
      title={
        <HistoryPlayers
          players={opponents()}
          played={props.outcome !== null}
          people={props.people}
        />
      }
      subtitle={<ReplaySubtitle {...props} />}
    >
      <GameSessionLayout
        actionsBeside
        status={<ReplaySteps {...props} />}
        actions={
          <Button
            title={<Trans>All games</Trans>}
            variant="outline"
            intent="neutral"
            icon={ArrowLeftIcon}
            onClick={() => props.onBack()}
            dataSet={{ testid: 'game-history-review-back-to-list' }}
          />
        }
        aside={
          <>
            <ReplayPlayers {...props} />
            <ReplayMoves {...props} />
          </>
        }
      >
        <GameBoardStage turn={<ShownPosition {...props} />}>
          {props.board}
        </GameBoardStage>
      </GameSessionLayout>
    </GameScreen>
  );
}
