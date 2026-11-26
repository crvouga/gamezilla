import { GameActionBar } from '@pkgs/ui-root-client-ts/game-action-bar';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { GameTableSeats } from '@pkgs/ui-root-client-ts/game-table-seat';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import type { FramePlaceProps } from './custom-game-screen-view';
import {
  FrameBoardSeatView,
  FrameNearSeatView,
  FrameOthersView,
} from './game-frame-table-view';
import type { FramePlaySeat, FrameTable } from './game-frame-view-types';

type Props = FramePlaceProps;

/**
 * The seats as the stage shows them: a stopped game has no one to move, so
 * no seat says "Your move" while Reopen game is the way on. A draw offered
 * to the person keeps their seat to move: the board still takes their move
 * (playing on declines it), so their seat keeps its tint and edge.
 */
function stageTable(props: Props): FrameTable {
  const table = props.table;
  const still = (seat: FramePlaySeat): FramePlaySeat =>
    seat.deciding ? { ...seat, deciding: false } : seat;
  if (!props.stopped && props.place.screen !== 'moves') return table;
  return {
    ...table,
    near: table.near === null ? null : still(table.near),
    others: table.others.map(still),
  };
}

/**
 * The board as the game draws it. A board that seats every player itself
 * (`table.shape === 'board'`) is lent each of them.
 */
function FrameBoard(props: Props): JSX.Element {
  return (
    <Show when={props.table.shape === 'board'} fallback={props.board}>
      <GameTableSeats
        seat={(side) => ({
          get name() {
            const table = stageTable(props);
            const seat = [table.near, ...table.others].find(
              (player) => player?.side === side
            );
            return seat?.plainName ?? null;
          },
          content: (
            <FrameBoardSeatView
              table={stageTable(props)}
              people={props.people}
              viewerSide={props.viewerSide}
              side={side}
            />
          ),
        })}
      >
        {props.board}
      </GameTableSeats>
    </Show>
  );
}

export function FrameStage(
  props: Props & { information: JSX.Element }
): JSX.Element {
  // The seats' density only: chips on a phone at a bigger table, strips
  // otherwise. What the stage shows is the same on every size.
  const mode = useLayoutMode();
  const compact = (): boolean => mode() !== 'wide';
  return (
    <GameBoardStage
      information={props.information}
      viewportFit={props.boardFit}
      align={props.boardAlign}
      workspace={props.boardWorkspace}
      dataSet={{
        ...props.boardState,
        testid: 'custom-game-public',
      }}
      others={
        <>
          <FrameOthersView
            table={stageTable(props)}
            people={props.people}
            onChoose={props.onChoose}
            viewerSide={props.viewerSide}
            compact={compact()}
          />
          <Show when={props.place.screen !== 'moves'}>
            <GameActionBar items={props.play.leadingBoardActions} />
          </Show>
        </>
      }
      own={
        <FrameNearSeatView
          table={stageTable(props)}
          people={props.people}
          onChoose={props.onChoose}
          viewerSide={props.viewerSide}
          compact={compact()}
        />
      }
    >
      <FrameBoard {...props} />
    </GameBoardStage>
  );
}
