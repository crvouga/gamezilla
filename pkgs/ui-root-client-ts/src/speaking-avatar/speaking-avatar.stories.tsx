import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SpeakingAvatar } from './index';
import Example from './speaking-avatar.example';

const meta = {
  id: 'components-feedback-speakingavatar',
  title: 'Molecules/SpeakingAvatar',
  component: SpeakingAvatar,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
