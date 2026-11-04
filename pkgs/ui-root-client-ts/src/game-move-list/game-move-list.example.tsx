/** @jsxImportSource solid-js */

import {
  GameMoveList,
  type GameMoveListEntry,
} from '@pkgs/ui-root-client-ts/game-move-list';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { MoveStrip } from '@pkgs/ui-root-client-ts/move-strip';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

const RED = { color: 'player7', mark: '●' } as const;
const YELLOW = { color: 'player5', mark: '◆' } as const;

/** Two seats in rotation, as Connect Four writes its columns. */
function twoSeats(labels: readonly string[]): readonly GameMoveListEntry[] {
  return labels.map((label, index) => ({
    ply: index + 1,
    label,
    swatch: index % 2 === 0 ? RED : YELLOW,
    accessibleName: `Move ${String(index + 1)}: ${label}`,
  }));
}

const SHORT = twoSeats(['4', '4', '5', '3', '3', '5', '6']);
const CHESS = twoSeats([
  'e4',
  'e5',
  'Nf3',
  'Nc6',
  'Bc4',
  'Bc5',
  'O-O',
  'Nf6',
  'd3',
  'd6',
  'Bg5',
  'h6',
  'Bxf6',
  'Qxf6',
]);

export default function GameMoveListExample(): JSX.Element {
  const [shown, setShown] = createSignal(SHORT.length);
  const [read, setRead] = createSignal(5);
  return (
    <ExampleRoot>
      <ExampleSection title="The shown turn inside a MoveStrip, whole and centred">
        <MoveStrip
          leading={
            <IconButton
              label="Previous move"
              size={32}
              disabled={shown() === 0}
              onClick={() => setShown(shown() - 1)}
            >
              <ChevronLeftIcon />
            </IconButton>
          }
          trailing={
            <IconButton
              label="Next move"
              size={32}
              disabled={shown() >= SHORT.length}
              onClick={() => setShown(shown() + 1)}
            >
              <ChevronRightIcon />
            </IconButton>
          }
        >
          <GameMoveList
            layout="turn"
            aria-label="Moves played"
            perTurn={2}
            current={shown()}
            moves={SHORT}
            onSelect={setShown}
          />
        </MoveStrip>
      </ExampleSection>
      <ExampleSection title="Table: a turn per line, an earlier move under review">
        <GameMoveList
          layout="table"
          aria-label="Moves played"
          perTurn={2}
          current={read()}
          moves={CHESS}
          onSelect={setRead}
        />
      </ExampleSection>
      <ExampleSection title="A window that starts mid-turn keeps its columns">
        <GameMoveList
          layout="table"
          aria-label="Latest moves"
          perTurn={2}
          current={CHESS.length}
          moves={CHESS.slice(5)}
          onSelect={() => undefined}
        />
      </ExampleSection>
      <ExampleSection title="No mover named: every move is its own turn">
        <GameMoveList
          layout="turn"
          aria-label="Plays"
          perTurn={1}
          current={2}
          moves={SHORT.map(({ swatch: _swatch, ...move }) => move)}
          onSelect={() => undefined}
        />
      </ExampleSection>
    </ExampleRoot>
  );
}
