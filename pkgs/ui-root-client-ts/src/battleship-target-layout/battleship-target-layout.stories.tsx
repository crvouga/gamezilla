import { createSignal } from 'solid-js';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { CellGridBoard } from '../cell-grid-board';
import { P } from '../text';
import { BattleshipRegionOverview, BattleshipTargetLayout } from './index';

const regions = Array.from(
  { length: 10 },
  (_, n) =>
    `${n % 2 ? 'F' : 'A'}${Math.floor(n / 2) * 2 + 1}–${n % 2 ? 'J' : 'E'}${Math.floor(n / 2) * 2 + 2}`
);
const columns = 'ABCDEFGHIJ'.split('');
const rows = Array.from({ length: 10 }, (_, n) => String(n + 1));
const cells = Array.from({ length: 100 }, (_, n) => ({
  id: `${columns[n % 10]}${rows[Math.floor(n / 10)]}`,
  label: n === 0 ? 'A1: miss' : 'Untried water',
  glyph: n === 0 ? '○' : '',
  tone: 'open' as const,
  enabled: n !== 0,
}));
const meta = {
  title: 'Games/Battleship/Target layout',
  component: BattleshipTargetLayout,
} satisfies Meta<typeof BattleshipTargetLayout>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Ten coarse areas retain the whole field while the working grid provides comfortable aim. */
export const Precise: Story = {
  tags: ['viewport-responsive'],
  args: {
    overview: null,
    working: null,
    controls: null,
  },
  render: (args) => {
    const [area, setArea] = createSignal(0);
    const selectedColumns = () =>
      columns.slice((area() % 2) * 5, (area() % 2) * 5 + 5);
    const selectedRows = () =>
      rows.slice(Math.floor(area() / 2) * 2, Math.floor(area() / 2) * 2 + 2);
    return (
      <BattleshipTargetLayout
        {...args}
        overview={
          <BattleshipRegionOverview
            label="Choose region"
            testId="target-layout"
            region={area()}
            regions={regions}
            onRegion={setArea}
            overview={
              <CellGridBoard
                label="Whole field"
                testId="map"
                columnLabels={columns}
                rowLabels={rows}
                cells={cells}
              />
            }
          />
        }
        controls={<P variant="caption">Aim: {regions[area()]}</P>}
        working={
          <CellGridBoard
            label="Precise aim"
            testId="aim"
            columnLabels={selectedColumns()}
            rowLabels={selectedRows()}
            cells={cells.filter(
              (cell) =>
                selectedColumns().includes(cell.id.charAt(0)) &&
                selectedRows().includes(cell.id.slice(1))
            )}
          />
        }
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('target-layout-area-9'));
    await expect(canvas.getByTestId('target-layout-area-9')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(
      canvas.getByTestId('map').querySelectorAll('[data-cell]')
    ).toHaveLength(100);
    await expect(canvas.getByTestId('aim-cell-J10')).toBeVisible();
  },
};
