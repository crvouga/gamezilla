import { parseFleet } from '@libs/battleship-shared-ts/battleship-fleet';
import {
  BATTLESHIP_PREFIX,
  decodeBattleshipPosition,
  otherSide,
  readBattleshipPosition,
} from '@libs/battleship-shared-ts/battleship-position';
import { t } from '@lingui/core/macro';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import { requireTwoPlayerSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { Button } from '@pkgs/ui-root-client-ts/button';
import {
  CellGridBoard,
  type CellGridCell,
  CellGridLegend,
  type CellGridLegendItem,
} from '@pkgs/ui-root-client-ts/cell-grid-board';
import { PairedPanels } from '@pkgs/ui-root-client-ts/paired-panels';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import {
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  on,
  Show,
} from 'solid-js';
import { COLUMN_LABELS, GLYPHS, ROW_LABELS, sideName } from './battleship-copy';
import { fleetGridCells, shotGridCells } from './battleship-grid-cells';

import { BattleshipTargetGrid } from './battleship-target-grid';

type BoardView = 'own' | 'target';

/**
 * One fleet's waters. The ships it has lost are its seat's facts and the
 * latest shot is the frame's turn line, so the panel is the grid alone:
 * the pair names it (its switch, or a title when both show side by side).
 */
function BoardPanel(props: {
  label: string;
  testId: string;
  view: BoardView;
  cells: readonly CellGridCell[];
  legend: JSX.Element;
  onFire?: (cell: string) => void;
}): JSX.Element {
  return (
    <StackVertical gap="xs" align="center" width="full">
      {props.legend}
      <CellGridBoard
        fill
        label={props.label}
        testId={`${props.testId}-${props.view}-grid`}
        cellTestId={(cell) => `${props.testId}-${props.view}-${cell}`}
        columnLabels={COLUMN_LABELS}
        rowLabels={ROW_LABELS}
        cells={props.cells}
        onActivate={props.onFire}
      />
    </StackVertical>
  );
}
/**
 * The key to the marks on the boards: a ship (on the viewer's own fleet
 * only), a miss, a hit and a sunk ship, each drawn as the grid draws it.
 */
function marks(ships: boolean): readonly CellGridLegendItem[] {
  const shots: readonly CellGridLegendItem[] = [
    { glyph: '○', tone: 'quiet', label: t`Miss` },
    { glyph: GLYPHS.hit, tone: 'alert', label: t`Hit` },
    { glyph: GLYPHS.sunk, tone: 'critical', outlined: true, label: t`Sunk` },
  ];
  return ships
    ? [{ glyph: GLYPHS.ship, tone: 'occupied', label: t`Ship` }, ...shots]
    : shots;
}

/** The cell just fired at, until the position (or a resync) answers it. */
function createAim(props: GameBoardProps) {
  const [aiming, setAiming] = createSignal<string | null>(null);
  const position = createMemo(() => props.position);
  const syncKey = createMemo(() => props.syncKey);
  createEffect(
    on([position, syncKey], () => setAiming(null), {
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
  const [selected, setSelected] = createSignal<string | null>(null);
  const position = createMemo(() => props.position);
  const syncKey = createMemo(() => props.syncKey);
  createEffect(on([position, syncKey], () => setSelected(null)));
  const [view, setView] = createSignal<BoardView>('own');
  createEffect(
    on([interactive, () => battle().winner], ([now, winner]) => {
      if (now || winner === props.orientation) setView('target');
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
      interactive: interactive() && aim.aiming() === null,
      aiming: aim.aiming(),
    })
  );
  // A shot being sent keeps its busy control after the frame stops input.
  const confirming = () =>
    (interactive() || aim.aiming() !== null) && view() === 'target';
  return (
    <StackVertical gap="xs" testId={props.testId}>
      <Show when={battle().winner !== null}>
        <P variant="bodyBold">{t`${sideName(otherSide(requireTwoPlayerSide(battle().winner ?? 'white')))} destroyed — all five ships sunk.`}</P>
      </Show>
      <BattlePanels
        testId={props.testId}
        labels={labels()}
        view={view()}
        onView={setView}
        own={ownCells()}
        target={targetCells().map((cell) =>
          cell.id === selected() && aim.aiming() === null
            ? { ...cell, emphasis: 'preview' }
            : cell
        )}
        onAim={setSelected}
        ships={viewer() !== null}
        inspect={!interactive() && aim.aiming() === null}
        confirmation={(region) => (
          <Show when={confirming()}>
            <ShotConfirmation
              region={region()}
              selected={selected()}
              pending={aim.aiming() !== null}
              testId={props.testId}
              onCancel={() => setSelected(null)}
              onFire={(cell) => {
                if (interactive() && aim.aiming() === null) aim.fire(cell);
              }}
            />
          </Show>
        )}
      />
    </StackVertical>
  );
}

function ShotConfirmation(props: {
  region: string;
  selected: string | null;
  pending: boolean;
  testId: string;
  onFire: (cell: string) => void;
  onCancel: () => void;
}): JSX.Element {
  return (
    <StackHorizontal
      gap="sm"
      align="center"
      testId={`${props.testId}-confirmation`}
    >
      <Show when={props.selected !== null && !props.pending}>
        <Button
          title={t`Cancel aim`}
          intent="neutral"
          variant="ghost"
          onClick={props.onCancel}
          dataSet={{ testid: `${props.testId}-cancel-aim` }}
        />
      </Show>
      <Button
        flex={1}
        disabled={props.selected === null || props.pending}
        loading={props.pending}
        loadingLabel={t`Firing at ${props.selected?.toUpperCase() ?? ''}`}
        onClick={() => {
          if (props.selected !== null && !props.pending)
            props.onFire(props.selected);
        }}
        dataSet={{ testid: `${props.testId}-fire` }}
        title={
          props.selected === null
            ? props.region === ''
              ? t`Choose a cell`
              : t`Choose a cell in ${props.region}`
            : t`Fire at ${props.selected.toUpperCase()}`
        }
      />
    </StackHorizontal>
  );
}

function BattlePanels(props: {
  testId: string;
  labels: Record<BoardView, string>;
  view: BoardView;
  onView: (view: BoardView) => void;
  own: readonly CellGridCell[];
  target: readonly CellGridCell[];
  onAim: (cell: string) => void;
  /** The viewer's own fleet is drawn, so its key names a ship. */
  ships: boolean;
  /** The viewer only looks at the target waters (see BattleshipTargetGrid). */
  inspect: boolean;
  confirmation: (region: () => string) => JSX.Element;
}): JSX.Element {
  return (
    <PairedPanels
      label={t`Boards`}
      testId={`${props.testId}-view`}
      keys={['own', 'target']}
      labels={props.labels}
      selected={props.view}
      onSelect={props.onView}
      titled
      switchPlacement="below"
      first={
        <BoardPanel
          label={props.labels.own}
          testId={props.testId}
          view="own"
          cells={props.own}
          legend={
            <CellGridLegend
              label={t`Key`}
              items={marks(props.ships)}
              testId={`${props.testId}-own-key`}
            />
          }
        />
      }
      second={
        <BattleshipTargetGrid
          label={props.labels.target}
          testId={props.testId}
          cells={props.target}
          onAim={props.onAim}
          inspect={props.inspect}
          legend={
            <CellGridLegend
              label={t`Key`}
              items={marks(false)}
              testId={`${props.testId}-target-key`}
            />
          }
          confirmation={props.confirmation}
        />
      }
    />
  );
}
