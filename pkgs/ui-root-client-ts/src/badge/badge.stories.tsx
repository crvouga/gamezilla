import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './badge.example';
import { Badge } from './index';

const meta = {
  id: 'components-data-display-badge',
  title: 'Atoms/Badge',
  component: Badge,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
