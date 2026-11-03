import { EMPTY_PERF_SNAPSHOT } from '@libs/app-root-shared-ts/types';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PerformanceSettingsScreenView } from './performance-screen-view';

const SAMPLED = {
  ...EMPTY_PERF_SNAPSHOT,
  fps: 58,
  inpMs: 96,
  longTaskCount: 3,
  longestScript: 'https://example.test/assets/board-renderer.js',
};

const meta = {
  id: 'screens-settings-performance',
  title: 'Screens/Settings/Performance',
  component: PerformanceSettingsScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true, controls: { exclude: ['metrics'] } },
  args: {
    enabled: false,
    metrics: EMPTY_PERF_SNAPSHOT,
    onEnabledChange: fn(),
  },
} satisfies Meta<typeof PerformanceSettingsScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The default: the monitor is off and no metrics are listed. */
export const Off: Story = {};

/** The monitor is on with samples, including the slowest script seen. */
export const OnWithMetrics: Story = {
  args: { enabled: true, metrics: SAMPLED },
};

/** Just turned on: nothing sampled yet, so INP reads as a dash. */
export const OnBeforeFirstSample: Story = { args: { enabled: true } };

/** A long script URL wraps inside its row instead of widening the screen. */
export const LongScriptName: Story = {
  args: {
    enabled: true,
    metrics: {
      ...SAMPLED,
      fps: 31,
      longestScript:
        'https://example.test/assets/a-very-long-chunk-name-for-the-chess-puzzle-engine-worker-bootstrap.js',
    },
  },
};

/** Turning the switch on asks for the monitor. */
export const TurnOn: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const target = await canvas.findByRole('switch', {
      name: 'Performance monitor',
    });
    await userEvent.click(target);
    await expect(args.onEnabledChange).toHaveBeenCalledWith(true);
  },
};
