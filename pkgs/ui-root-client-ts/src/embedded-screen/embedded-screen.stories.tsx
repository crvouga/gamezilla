import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './embedded-screen.example';
import { EmbeddedScreen } from './index';

const meta = {
  id: 'templates-embedded-content',
  title: 'Templates/EmbeddedScreen',
  component: EmbeddedScreen,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
