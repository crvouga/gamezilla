import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './catalog.example';
import { CatalogDetail } from './index';

const meta = {
  id: 'layouts-catalog',
  title: 'Templates/CatalogDetail',
  component: CatalogDetail,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
