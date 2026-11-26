import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { BattleshipNavigableGrid } from './index';

const meta = {
  id: 'organisms-games-battleship-navigable-grid',
  title: 'Organisms/Games/Battleship/Navigable grid',
  component: BattleshipNavigableGrid,
  args: {
    fitLabel: 'Fit board',
    label: 'Target waters',
    testId: 'waters',
    battleshipSurface: 'target',
    columnLabels: ['A', 'B'],
    rowLabels: ['1', '2'],
    cells: ['a1', 'b1', 'a2', 'b2'].map((id) => ({
      id,
      label: id.toUpperCase(),
      glyph: '',
      enabled: true,
      tone: 'open' as const,
    })),
  },
} satisfies Meta<typeof BattleshipNavigableGrid>;
export default meta;
type Story = StoryObj<typeof meta>;
export const KeyboardInspection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cell = canvas.getByRole('button', { name: 'A1' });
    cell.focus();
    await userEvent.keyboard('+');
    await expect(
      canvas.getByRole('button', { name: 'Fit board' })
    ).toBeVisible();
    await userEvent.keyboard('0');
    await expect(
      canvas.queryByRole('button', { name: 'Fit board' })
    ).not.toBeInTheDocument();
  },
};
