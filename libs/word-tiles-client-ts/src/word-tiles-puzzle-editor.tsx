import type { PuzzleEditorProps } from '@libs/game-puzzle-client-ts/puzzle-content-client';
import {
  cellName,
  parseCell,
} from '@libs/word-tiles-shared-ts/word-tiles-board';
import { DEFAULT_LEXICON_KEY } from '@libs/word-tiles-shared-ts/word-tiles-lexicon';
import {
  EMPTY_BOARD,
  newPosition,
} from '@libs/word-tiles-shared-ts/word-tiles-position';
import {
  encodePuzzle,
  readPuzzle,
  type WordTilesPuzzle,
} from '@libs/word-tiles-shared-ts/word-tiles-puzzle';
import { RULESET } from '@libs/word-tiles-shared-ts/word-tiles-ruleset';
import { t } from '@lingui/core/macro';
import { Select } from '@pkgs/ui-root-client-ts/select';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { WordTileBoard } from '@pkgs/ui-root-client-ts/word-tile-board';
import { createMemo, createSignal, type JSX, Show } from 'solid-js';
import { useWordTilesLexicon } from './use-word-tiles-lexicon';
import { newCandidate } from './word-tiles-candidate';
import {
  boardCells,
  COLUMN_LABELS,
  ROW_LABELS,
  squareText,
} from './word-tiles-cells';

/** A new one-move challenge: an empty board, a rack and a modest target. */
export function initialWordTilesPuzzle(): string {
  return encodePuzzle({
    ruleset: RULESET.id,
    lexicon: DEFAULT_LEXICON_KEY,
    board: EMPTY_BOARD,
    rack: 'AEINRST',
    target: 20,
  });
}

/** What a tap on the board writes: a letter, a blank playing a letter, or nothing. */
type Brush = { readonly letter: string; readonly blank: boolean } | null;

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function brushOptions() {
  return [
    { value: 'clear', label: t`Clear a square` },
    ...LETTERS.map((letter) => ({ value: letter, label: letter })),
    ...LETTERS.map((letter) => ({
      value: letter.toLowerCase(),
      label: t`Blank as ${letter}`,
    })),
  ];
}

function painted(board: string, cell: number, brush: Brush): string {
  const cells = board.split('');
  cells[cell] =
    brush === null
      ? '.'
      : brush.blank
        ? brush.letter.toLowerCase()
        : brush.letter;
  return cells.join('');
}

function Fields(props: {
  puzzle: WordTilesPuzzle;
  disabled: boolean;
  onChange: (next: WordTilesPuzzle) => void;
}): JSX.Element {
  return (
    <>
      <TextInput
        label={t`Rack (up to seven letters, ? for a blank)`}
        value={props.puzzle.rack}
        disabled={props.disabled}
        dataSet={{ testid: 'word-tiles-editor-rack' }}
        onChangeText={(text) =>
          props.onChange({
            ...props.puzzle,
            rack: text
              .toUpperCase()
              .replace(/[^A-Z?]/g, '')
              .slice(0, 7),
          })
        }
      />
      <TextInput
        type="number"
        label={t`Target points`}
        value={String(props.puzzle.target)}
        disabled={props.disabled}
        dataSet={{ testid: 'word-tiles-editor-target' }}
        onChangeText={(text) =>
          props.onChange({ ...props.puzzle, target: Number(text) || 0 })
        }
      />
    </>
  );
}

/** The game's own builder tools: the board's tiles, the rack and the target. */
export function WordTilesPuzzleEditor(props: PuzzleEditorProps): JSX.Element {
  const puzzle = createMemo(() => readPuzzle(props.definition));
  const [brush, setBrush] = createSignal('clear');
  // Board words are checked against the pinned list, loaded here for the shell.
  useWordTilesLexicon(() => DEFAULT_LEXICON_KEY);
  const change = (next: WordTilesPuzzle) => props.onChange(encodePuzzle(next));
  const current = (): Brush => {
    const value = brush();
    if (value === 'clear') return null;
    return {
      letter: value.toUpperCase(),
      blank: value !== value.toUpperCase(),
    };
  };
  return (
    <Show
      when={(() => {
        const read = puzzle();
        return read.valid ? read.value : null;
      })()}
      fallback={
        <P>{t`This draft cannot be opened. Choose an earlier saved copy to continue.`}</P>
      }
    >
      {(read) => (
        <StackVertical gap="md">
          <Fields puzzle={read()} disabled={props.disabled} onChange={change} />
          <Select
            label={t`Square tool`}
            options={brushOptions()}
            value={brush()}
            disabled={props.disabled}
            onValueChange={(value) => setBrush(value)}
            dataSet={{ testid: 'word-tiles-editor-brush' }}
          />
          <WordTileBoard
            label={t`Puzzle board to edit, fifteen columns and fifteen rows`}
            testId="word-tiles-editor"
            columnLabels={COLUMN_LABELS}
            rowLabels={ROW_LABELS}
            cells={boardCells(
              { ...newPosition(2, read().lexicon), board: read().board },
              newCandidate('', null),
              false
            ).map((cell) => ({ ...cell, enabled: !props.disabled }))}
            squareText={squareText}
            onActivate={(id) => {
              const cell = parseCell(id);
              if (cell !== null)
                change({
                  ...read(),
                  board: painted(read().board, cell, current()),
                });
            }}
          />
          <P variant="caption" tone="secondary">
            {t`Board tiles must join up through the centre square ${cellName(112)} and spell words from the list.`}
          </P>
        </StackVertical>
      )}
    </Show>
  );
}
