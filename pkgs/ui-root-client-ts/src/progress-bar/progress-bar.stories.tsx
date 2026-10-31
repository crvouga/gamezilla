import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ProgressBar } from './index';
import Example from './progress-bar.example';

const meta = {
  id: 'components-feedback-progressbar',
  title: 'Atoms/ProgressBar',
  component: ProgressBar,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
