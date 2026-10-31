import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './combobox.example';
import { Combobox } from './index';

const meta = {
  id: 'components-inputs-combobox',
  title: 'Molecules/Combobox',
  component: Combobox,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
