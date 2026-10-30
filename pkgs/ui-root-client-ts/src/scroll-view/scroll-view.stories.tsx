import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ScrollView } from './index';
import Example from './scroll-view.example';

const meta = {
  title: 'Layouts/ScrollView',
  component: ScrollView,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
