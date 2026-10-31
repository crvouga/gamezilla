import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './embedded-screen.example';
import { EmbeddedScreen } from './index';

const meta = {
  id: 'templates-embedded-content',
  title: 'Templates/Embedded content',
  component: EmbeddedScreen,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
