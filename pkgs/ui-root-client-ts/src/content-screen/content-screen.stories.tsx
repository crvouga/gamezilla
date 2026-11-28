import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './content-screen.example';
import { ContentScreen } from './index';

const meta = {
  id: 'templates-details-and-documents',
  title: 'Templates/ContentScreen',
  component: ContentScreen,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
