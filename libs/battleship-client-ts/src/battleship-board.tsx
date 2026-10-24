import { parseFleet } from '@libs/battleship-shared-ts/battleship-fleet';
import { sunkShipCells } from '@libs/battleship-shared-ts/battleship-intel';
import {
  BATTLESHIP_PREFIX,
  type BattleshipPosition,
  decodeBattleshipPosition,
  otherSide,
  parseShotAction,
  readBattleshipPosition,
  type Shot,
} from '@libs/battleship-shared-ts/battleship-position';
import { t } from '@lingui/core/macro';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { requireTwoPlayerSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import {
  CellGridBoard,
  type CellGridCell,
} from '@pkgs/ui-root-client-ts/cell-grid-board';
import { H3 } from '@pkgs/ui-root-client-ts/heading';
import { PairedPanels } from '@pkgs/ui-root-client-ts/paired-panels';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  on,
  Show,
} from 'solid-js';
import {
  COLUMN_LABELS,
  ROW_LABELS,
  shipName,
  shotSentence,
  sideName,
  turnSentence,
} from './battleship-copy';
import { fleetGridCells, shotGridCells } from './battleship-grid-cells';

type BoardView = 'own' | 'target';

function SunkTags(props: { shots: readonly Shot[] }): JSX.Element {
  const sunk = createMemo(() => [...sunkShipCells(props.shots).keys()]);
  return (
    <Show when={sunk().length > 0}>
      <StackHorizontal gap="xs" wrap>
        <For each={sunk()}>
          {(ship) => {
            const name = shipName(ship);
            return <Badge intent="neutral" label={t`${name} sunk`} />;
          }}
        </For>
      </StackHorizontal>
    </Show>
  );
}
function BoardPanel(props: {
  label: string;
  testId: string;
  view: BoardView;
  cells: readonly CellGridCell[];
  shots: readonly Shot[];
  onFire?: (cell: string) => void;
}): JSX.Element {
  return (
    <>
      <H3 size="label">{props.label}</H3>
      <CellGridBoard
        label={props.label}
        testId={`${props.testId}-${props.view}-grid`}
        cellTestId={(cell) => `${props.testId}-${props.view}-${cell}`}
        columnLabels={COLUMN_LABELS}
        rowLabels={ROW_LABELS}
        cells={props.cells}
        onActivate={props.onFire}
      />
      <SunkTags shots={props.shots} />
    </>
  );
}
/** The latest shot and whose turn it is, in words; `viewer` is `null` for a watcher. */
function statusText(
  battle: BattleshipPosition,
  viewer: GameSide | null
): string {
  const action = battle.actions.at(-1);
  const shot = action === undefined ? null : parseShotAction(action);
  const shooter: GameSide = battle.actions.length % 2 === 1 ? 'white' : 'black';
  const fired =
    shot === null
      ? ''
      : shotSentence(shot, shooter === viewer ? null : sideName(shooter));
  const turn = turnSentence({
    turn: battle.turn,
    winner: battle.winner,
    viewer,
  });
  return fired === '' ? turn : `${fired} ${turn}`;
}
/** The cell just fired at, until the position (or a resync) answers it. */
function createAim(props: GameBoardProps) {
  const [aiming, setAiming] = createSignal<string | null>(null);
  createEffect(
    on([() => props.position, () => props.syncKey], () => setAiming(null), {
      defer: true,
    })
  );
  return {
    aiming,
    fire: (cell: string): void => {
      setAiming(cell);
      props.onAction(cell);
    },
  };
}

/**
 * Two boards: the viewer's own waters (their fleet, from their own setup
 * only, and the shots fired at it) and the rival's (only the public shots).
 * A watcher sees both as public shot boards, named by side.
 */
export function BattleshipBoard(props: GameBoardProps): JSX.Element {
  const battle = createMemo(
    () =>
      readBattleshipPosition(props.position) ??
      decodeBattleshipPosition(BATTLESHIP_PREFIX)
  );
  const fleet = createMemo(() =>
    props.setup === null ? null : parseFleet(props.setup)
  );
  const viewer = () => (props.setup === null ? null : props.orientation);
  const rival = () => otherSide(requireTwoPlayerSide(props.orientation));
  const interactive = () => props.interactive && battle().winner === null;
  const aim = createAim(props);
  const [view, setView] = createSignal<BoardView>('own');
  createEffect(
    on(interactive, (now) => {
      if (now) setView('target');
    })
  );
  const incoming = () => battle().shots[rival()];
  const outgoing = () =>
    battle().shots[requireTwoPlayerSide(props.orientation)];
  const labels = createMemo(() => {
    if (viewer() !== null) return { own: t`Your fleet`, target: t`Targeting` };
    const own = sideName(props.orientation);
    const target = sideName(rival());
    return { own: t`${own} waters`, target: t`${target} waters` };
  });
  const ownCells = createMemo(() => {
    const mine = fleet();
    return mine === null
      ? shotGridCells({ shots: incoming(), interactive: false, aiming: null })
      : fleetGridCells(mine, incoming());
  });
  const targetCells = createMemo(() =>
    shotGridCells({
      shots: outgoing(),
      interactive: interactive(),
      aiming: aim.aiming(),
    })
  );
  return (
    <StackVertical gap="md" testId={props.testId}>
      <P
        variant="caption"
        role="status"
        aria-live="polite"
        testId={`${props.testId}-status`}
      >
        {statusText(battle(), viewer())}
      </P>
      <PairedPanels
        label={t`Boards`}
        testId={`${props.testId}-view`}
        keys={['own', 'target']}
        labels={labels()}
        selected={view()}
        onSelect={setView}
        first={
          <BoardPanel
            label={labels().own}
            testId={props.testId}
            view="own"
            cells={ownCells()}
            shots={incoming()}
          />
        }
        second={
          <BoardPanel
            label={labels().target}
            testId={props.testId}
            view="target"
            cells={targetCells()}
            shots={outgoing()}
            onFire={aim.fire}
          />
        }
      />
    </StackVertical>
  );
}
