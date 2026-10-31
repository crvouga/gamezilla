import {
  PathGridBoard,
  type PathGridBoardProps,
  type PathGridTone,
} from '@pkgs/ui-root-client-ts/path-grid-board';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

const TONES: readonly PathGridTone[] = [
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
];

/** All six pair tones, connected and unfinished lines, editing and read-only states. */
export default function PathGridBoardExample(
  props: Pick<PathGridBoardProps, 'disabled' | 'onActivate'> = {}
): JSX.Element {
  const [selected, setSelected] = createSignal(0);
  return (
    <ExampleRoot>
      <StackVertical gap="lg">
        <PathGridBoard
          columns={6}
          rows={6}
          label="Labeled path colors"
          testId="example-paths"
          disabled={props.disabled}
          cellLabel={(index) =>
            `Column ${(index % 6) + 1}, row ${Math.floor(index / 6) + 1}`
          }
          endpoints={TONES.flatMap((tone, row) =>
            [0, 5].map((column) => ({
              cell: row * 6 + column,
              label: String(row + 1),
              tone,
              connected: row < selected(),
            }))
          )}
          lines={TONES.map((tone, row) => ({
            id: tone,
            tone,
            connected: row < selected(),
            cells: Array.from(
              { length: row < selected() ? 6 : 3 },
              (_, column) => row * 6 + column
            ),
          }))}
          onActivate={(index) => {
            props.onActivate?.(index);
            setSelected(Math.floor(index / 6) + 1);
          }}
        />
      </StackVertical>
    </ExampleRoot>
  );
}
