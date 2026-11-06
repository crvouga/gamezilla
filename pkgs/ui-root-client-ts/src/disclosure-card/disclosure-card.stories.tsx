import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './disclosure-card.example';
import { DisclosureCard } from './index';

const meta = {
  id: 'components-layout-disclosurecard',
  title: 'Molecules/DisclosureCard',
  component: DisclosureCard,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Closed: the title and a summary of what it holds, on one row. */
export const Closed: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};

/** Open: the fields under the row. */
export const Open: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example defaultOpen />,
};
