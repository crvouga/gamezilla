import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { BattleshipRegionOverview } from '../battleship-target-layout';
import { Button } from '../button';
import { CellGridBoard } from '../cell-grid-board';
import { Select } from '../select';
import { P } from '../text';
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

/** Ship and rotation controls share a compact fleet context above a stable working quadrant. */
export const Enlarged: Story = {
  tags: ['viewport-responsive'],
  args: {
    overviewLabel: 'Choose region',
    controls: null,
    working: null,
    overview: null,
  },
  render: (args) => (
    <BattleshipPlacementLayout
      {...args}
      feedback={
        <P variant="caption">
          Carrier: 5 cells across. Choose its first cell to place it.
        </P>
      }
      commands={
        <Button title="Rotate down" variant="outline" intent="neutral" />
      }
      controls={
        <>
          <Select
            label="Ship"
            value="carrier"
            onValueChange={() => undefined}
            options={[{ value: 'carrier', label: 'Carrier · 5' }]}
          />
        </>
      }
      region={<P variant="label">Place in A–E / 1–5</P>}
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
        <BattleshipRegionOverview
          placement
          label="Fleet overview"
          testId="placement-layout"
          region={0}
          regions={['A–E / 1–5', 'F–J / 1–5', 'A–E / 6–10', 'F–J / 6–10']}
          onRegion={() => undefined}
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
      }
    />
  ),
};
