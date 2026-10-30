import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './content-screen.example';
import { ContentScreen } from './index';

const meta = {
  id: 'templates-details-and-documents',
  title: 'Templates/Details and documents',
  component: ContentScreen,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
