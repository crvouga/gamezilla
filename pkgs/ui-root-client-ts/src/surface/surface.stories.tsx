import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Surface } from './index';
import Example from './surface.example';

const meta = {
  id: 'primitives-surface',
  title: 'Atoms/Surface',
  component: Surface,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
