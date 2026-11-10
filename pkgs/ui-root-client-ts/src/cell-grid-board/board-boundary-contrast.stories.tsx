import { expect, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { CellGridBoard } from './index';

export default {
  id: 'games-cellgridboard-boundary-contrast',
  title: 'Games/CellGridBoard/Boundary contrast',
  component: CellGridBoard,
} satisfies Meta<typeof CellGridBoard>;

function luminance(color: string): number {
  const channels = color
    .match(/[\d.]+/g)
    ?.slice(0, 3)
    .map(Number);
  if (channels?.length !== 3) throw new Error(`Invalid RGB color: ${color}`);
  const linear = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [red, green, blue] = linear;
  if (red === undefined || green === undefined || blue === undefined)
    throw new Error('Missing RGB channel');
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

// regression: battleship-dark-grid-boundaries
export const OpenWater: StoryObj<typeof CellGridBoard> = {
  // Related board components keep a desktop reference beside the phone one.
  tags: ['viewport-responsive'],
  args: {
    boardTheme: 'battleship',
    label: 'Open water',
    testId: 'water',
    columnLabels: ['A'],
    rowLabels: ['1'],
    cells: [
      {
        id: 'a1',
        glyph: '',
        label: 'A1 open water',
        tone: 'open',
        enabled: true,
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const cell = await within(canvasElement).findByTestId('water-cell-a1');
    const view = cell.ownerDocument.defaultView;
    if (!view) throw new Error('The story requires a browser window');
    const style = view.getComputedStyle(cell);
    const border = luminance(style.borderTopColor);
    const fill = luminance(style.backgroundColor);
    await expect(
      (Math.max(border, fill) + 0.05) / (Math.min(border, fill) + 0.05)
    ).toBeGreaterThanOrEqual(3);
  },
};
