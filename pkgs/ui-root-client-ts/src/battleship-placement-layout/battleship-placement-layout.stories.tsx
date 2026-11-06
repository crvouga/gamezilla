import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { CellGridBoard } from '../cell-grid-board';
import { Select } from '../select';
import { BattleshipPlacementLayout } from './index';

const columns = 'ABCDEFGHIJ'.split('');
const rows = Array.from({ length: 10 }, (_, i) => String(i + 1));
const cells = (size: number) =>
  Array.from({ length: size * size }, (_, i) => ({
    id: String(i),
    label: `Water ${i + 1}`,
    glyph: i < 5 ? '■' : '',
    tone: i < 5 ? ('occupied' as const) : ('open' as const),
    enabled: false,
  }));
const meta = {
  title: 'Games/Battleship/Placement layout',
  component: BattleshipPlacementLayout,
} satisfies Meta<typeof BattleshipPlacementLayout>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A bounded working quadrant stays beside a smaller fleet overview, wrapping on phones. */
export const Enlarged: Story = {
  args: {
    overviewLabel: 'Fleet overview',
    controls: null,
    working: null,
    overview: null,
  },
  render: (args) => (
    <BattleshipPlacementLayout
      {...args}
      controls={
        <>
          <Select
            label="Ship"
            value="carrier"
            onValueChange={() => undefined}
            options={[{ value: 'carrier', label: 'Carrier · 5' }]}
          />
          <Select
            label="Region"
            value="nw"
            onValueChange={() => undefined}
            options={[{ value: 'nw', label: 'A–E / 1–5' }]}
          />
        </>
      }
      working={
        <CellGridBoard
          label="Working region"
          testId="working"
          columnLabels={columns.slice(0, 5)}
          rowLabels={rows.slice(0, 5)}
          cells={cells(5)}
        />
      }
      overview={
        <CellGridBoard
          label="Fleet"
          testId="overview"
          columnLabels={columns}
          rowLabels={rows}
          cells={cells(10)}
        />
      }
    />
  ),
};
