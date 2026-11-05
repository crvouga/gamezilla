import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import { Trans } from '@lingui/solid/macro';
import { GameActions, GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { For, type JSX } from 'solid-js';
import {
  FrameHistoryLink,
  type FrameReviewHandlers,
} from './game-frame-record-view';
import { FrameSeatStripView } from './game-frame-table-view';
import type {
  FramePeople,
  FramePhase,
  FramePlaySeat,
  FrameRecord,
  FrameTable,
} from './game-frame-view-types';

/**
 * A game played in real time (its record has no turns) once it is played:
 * there are no moves to step through, so beside a wide arena the rail is
 * its scoreboard, and nothing waits behind an empty record.
 */
export function frameArena(
  phase: FramePhase,
  record: FrameRecord | null
): boolean {
  return (
    record !== null &&
    !record.turns &&
    (phase === 'active' || phase === 'completed')
  );
}

/**
 * Whether a real-time game's record has anything of its own to show (an
 * earlier game to choose, a refused review); otherwise only its way to the
 * space's history is kept, beside the game's commands.
 */
export function arenaRecordShown(record: FrameRecord): boolean {
  return record.earlier.length > 0 || record.error !== '';
}

/** The seats in reading order: the person's own first, then the others. */
function scoreboardSeats(table: FrameTable): readonly FramePlaySeat[] {
  return table.near === null ? table.others : [table.near, ...table.others];
}

/**
 * Beside a wide arena: every player as a full strip (their figure, out or
 * reconnecting) in one card under the game's plain line (the round), the space's history as a quiet link at its
 * title and the game's commands at its foot, so the arena can be the
 * widest thing on the screen with no empty card beside it.
 */
export function FrameArenaRailView(
  props: FrameReviewHandlers & {
    readonly table: FrameTable;
    readonly record: FrameRecord;
    readonly people?: FramePeople | undefined;
    readonly viewerSide?: string | null | undefined;
    readonly onChoose: (input: CustomGameInput) => Promise<void>;
    /** The game's plain line (the round, the serve), under the title. */
    readonly caption?: string | undefined;
    readonly commands: JSX.Element;
  }
): JSX.Element {
  return (
    <GameSection
      title={<Trans>Players</Trans>}
      description={props.caption}
      dataSet={{ testid: 'custom-game-scoreboard' }}
      trailing={<FrameHistoryLink {...props} quiet />}
      footer={<GameActions>{props.commands}</GameActions>}
    >
      <StackVertical gap="sm">
        <For each={scoreboardSeats(props.table)}>
          {(seat) => (
            <FrameSeatStripView
              seat={seat}
              people={props.people}
              onChoose={props.onChoose}
              viewerSide={props.viewerSide}
            />
          )}
        </For>
      </StackVertical>
    </GameSection>
  );
}
