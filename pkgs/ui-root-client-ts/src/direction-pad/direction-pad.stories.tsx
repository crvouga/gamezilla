import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example, { DIRECTION_LABELS } from './direction-pad.example';
import { DirectionPad } from './index';

const meta = {
  id: 'components-inputs-directionpad',
  title: 'Molecules/DirectionPad',
  component: DirectionPad,
  tags: ['autodocs'],
  args: {
    labels: DIRECTION_LABELS,
    disabled: false,
    testId: 'direction-pad-story',
    onDirection: fn(),
  },
  argTypes: {
    labels: { control: false },
    disabled: { control: 'boolean' },
    testId: { control: false },
    onDirection: { control: false },
  },
  parameters: { controls: { include: ['disabled'] } },
} satisfies Meta<typeof DirectionPad>;
export default meta;

export const States: StoryObj = {
  tags: ['!manifest'],
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};

/** Offer directional game input on touch devices and keyboards. */
export const Interactive: StoryObj<typeof meta> = {};

/**
 * A rider that cannot steer now keeps its pad's room with nothing in it,
 * so the arena above never moves: no button shows, steers or is announced.
 */
export const Concealed: StoryObj<typeof meta> = {
  args: { concealed: true, disabled: true },
  play: async ({ args, canvasElement }) => {
    const pad = within(canvasElement).getByTestId('direction-pad-story');
    await expect(pad).toHaveAttribute('aria-hidden', 'true');
    await expect(pad.getBoundingClientRect().height).toBeGreaterThan(0);
    await expect(
      within(canvasElement).getByTestId('direction-pad-story-up')
    ).toBeDisabled();
    await expect(args.onDirection).not.toHaveBeenCalled();
  },
};

/** Send one direction per activation, including touch events that also generate a click. */
export const Activate: StoryObj<typeof meta> = {
  play: async ({ canvasElement, args, step }) => {
    const canvas = within(canvasElement);
    await step(
      'A touch press steers once, including its generated click',
      async () => {
        const up = canvas.getByRole('button', { name: 'Steer up' });
        await userEvent.pointer([
          { target: up, keys: '[TouchA>]' },
          { target: up, keys: '[/TouchA]' },
        ]);
        await expect(args.onDirection).toHaveBeenCalledTimes(1);
        await expect(args.onDirection).toHaveBeenLastCalledWith('up');
      }
    );
    await step('Keyboard activation steers once', async () => {
      canvas.getByRole('button', { name: 'Steer right' }).focus();
      await userEvent.keyboard('{Enter}');
      await expect(args.onDirection).toHaveBeenCalledTimes(2);
      await expect(args.onDirection).toHaveBeenLastCalledWith('right');
    });
  },
};
