import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { KeyHints } from './index';
import Example from './key-hints.example';

const meta = {
  id: 'components-display-keyhints',
  title: 'Molecules/KeyHints',
  component: KeyHints,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** A board's keys, each beside what it does. */
export const BoardKeys: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
