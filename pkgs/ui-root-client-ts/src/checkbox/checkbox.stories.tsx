import { createSignal } from 'solid-js';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './checkbox.example';
import { Checkbox } from './index';

const meta = {
  title: 'Components/Inputs/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};

export const Controlled: StoryObj = {
  render: () => {
    const [checked, setChecked] = createSignal(false);
    return (
      <Checkbox
        checked={checked()}
        onToggle={setChecked}
        aria-label="Receive invitations"
      />
    );
  },
  play: async ({ canvasElement }) => {
    const checkbox =
      canvasElement.querySelector<HTMLElement>('[role="checkbox"]');
    if (!checkbox) throw new Error('Checkbox must expose its role');
    checkbox.click();
    await Promise.resolve();
    if (checkbox.getAttribute('aria-checked') !== 'true')
      throw new Error('Controlled signal must update the checkbox');
  },
};
