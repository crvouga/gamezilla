import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { StepTrack } from './index';
import Example from './step-track.example';

const meta = {
  id: 'components-inputs-steptrack',
  title: 'Molecules/StepTrack',
  component: StepTrack,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Steps with their actions, then steps that are only named. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
