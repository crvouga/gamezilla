import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SoundIndicator } from './index';
import Example from './sound-indicator.example';

const meta = {
  title: 'Components/Feedback/SoundIndicator',
  component: SoundIndicator,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
