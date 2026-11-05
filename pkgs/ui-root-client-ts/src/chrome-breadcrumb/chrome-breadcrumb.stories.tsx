import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './chrome-breadcrumb.example';
import { ChromeBreadcrumb } from './index';

const meta = {
  id: 'components-navigation-chromebreadcrumb',
  title: 'Molecules/ChromeBreadcrumb',
  component: ChromeBreadcrumb,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** The room alone, the room as the way back, the game as the way back, and truncation. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
