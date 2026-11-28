import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SuggestionList } from './index';
import Example from './suggestion-list.example';

const meta = {
  id: 'components-inputs-suggestionlist',
  title: 'Molecules/SuggestionList',
  component: SuggestionList,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
