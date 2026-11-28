import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './form-actions-footer.example';
import { FormActionsFooter } from './index';

const meta = {
  id: 'components-inputs-formactionsfooter',
  title: 'Molecules/FormActionsFooter',
  component: FormActionsFooter,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
