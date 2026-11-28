import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './form-screen.example';
import { FormScreen } from './index';

const meta = {
  id: 'templates-form-editor',
  title: 'Templates/FormScreen',
  component: FormScreen,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
