import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './catalog.example';
import { CatalogDetail } from './index';

const meta = {
  id: 'layouts-catalog',
  title: 'Templates/Catalog',
  component: CatalogDetail,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
