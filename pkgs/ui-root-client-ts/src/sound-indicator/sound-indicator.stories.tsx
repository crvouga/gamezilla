import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SoundIndicator } from './index';
import Example from './sound-indicator.example';

const meta = {
  id: 'components-feedback-soundindicator',
  title: 'Molecules/SoundIndicator',
  component: SoundIndicator,
  tags: ['autodocs'],
  argTypes: {
    state: { control: 'inline-radio', options: ['idle', 'playing', 'muted'] },
    size: { control: 'select', options: [12, 16, 20, 24, 32] },
    backgroundColor: {
      control: 'select',
      options: ['surface', 'tintSubtle', 'background'],
    },
    color: { control: 'select', options: ['text', 'tint', 'textSecondary'] },
    mutedColor: {
      control: 'select',
      options: ['textSecondary', 'text', 'tint'],
    },
    dataSet: { control: false },
  },
} satisfies Meta<typeof SoundIndicator>;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  tags: ['!manifest'],
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};

/** Show that audio is playing without adding a second playback control. */
export const Interactive: StoryObj<typeof meta> = {
  args: {
    state: 'playing',
    size: 20,
    backgroundColor: 'surface',
    color: 'text',
    mutedColor: 'textSecondary',
  },
  parameters: { layout: 'centered' },
};
