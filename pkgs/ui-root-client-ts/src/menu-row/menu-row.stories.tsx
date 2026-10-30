import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MenuRow } from './index';
import Example from './menu-row.example';

const meta = {
  title: 'Components/Data Display/MenuRow',
  component: MenuRow,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
