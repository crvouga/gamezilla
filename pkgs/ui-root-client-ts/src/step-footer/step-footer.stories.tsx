import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { StepFooter } from './index';
import Example from './step-footer.example';

const meta = {
  id: 'components-inputs-stepfooter',
  title: 'Molecules/StepFooter',
  component: StepFooter,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** The step that finishes a builder: its status, an outline and a filled step. */
export const PublishStep: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
