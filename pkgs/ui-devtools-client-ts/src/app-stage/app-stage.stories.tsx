import { expect, fireEvent, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example, { type AppStageExampleProps } from './app-stage.example';
import { AppStage } from './index';

const meta = {
  id: 'product-developer-tools-appstage',
  title: 'Organisms/AppStage',
  component: AppStage,
  tags: ['autodocs'],
  args: { shown: 'alice' },
  argTypes: {
    shown: { control: 'select', options: ['alice', 'bob', 'logs'] },
  },
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['shown'] },
  },
  render: (args) => <Example {...args} />,
} satisfies Meta<AppStageExampleProps>;
export default meta;

type Story = StoryObj<AppStageExampleProps>;

function part(root: HTMLElement, selector: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(selector);
  if (element === null) throw new Error(`missing ${selector}`);
  return element;
}

const stage = (root: HTMLElement): HTMLElement =>
  part(root, '[data-stage-part="stage"]');
const handle = (root: HTMLElement): HTMLElement =>
  part(root, '[data-stage-part="handle"]');

async function press(element: HTMLElement): Promise<void> {
  await fireEvent.pointerDown(element, { button: 0, pointerId: 1 });
  await fireEvent.pointerUp(element, { button: 0, pointerId: 1 });
}

/** One device, edge to edge, under the handle. */
export const Device: Story = {};

/** A view behind the devices, under the same handle. */
export const BehindTheDevices: Story = { args: { shown: 'logs' } };

/** A press switches to the next view, around again, and a view left keeps its state. */
export const PressForTheNext: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Alice kept its state: 0' })
    );
    await press(handle(canvasElement));
    await expect(stage(canvasElement)).toHaveAttribute(
      'data-shown-view',
      'bob'
    );
    await press(handle(canvasElement));
    await expect(stage(canvasElement)).toHaveAttribute(
      'data-shown-view',
      'logs'
    );
    await press(handle(canvasElement));
    await expect(stage(canvasElement)).toHaveAttribute(
      'data-shown-view',
      'alice'
    );
    await expect(
      canvas.getByRole('button', { name: 'Alice kept its state: 1' })
    ).toBeVisible();
  },
};

/** The keyboard switches too: Enter or Space on the handle. */
export const WithTheKeyboard: Story = {
  play: async ({ canvasElement }) => {
    const button = handle(canvasElement);
    button.focus();
    await fireEvent.keyDown(button, { key: 'Enter' });
    await expect(stage(canvasElement)).toHaveAttribute(
      'data-shown-view',
      'bob'
    );
    await fireEvent.keyDown(button, { key: ' ' });
    await expect(stage(canvasElement)).toHaveAttribute(
      'data-shown-view',
      'logs'
    );
  },
};
