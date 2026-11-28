import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ScrollView } from './index';
import Example from './scroll-view.example';

const meta = {
  id: 'layouts-scrollview',
  title: 'Atoms/ScrollView',
  component: ScrollView,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
