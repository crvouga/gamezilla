import { expect, userEvent, within } from 'storybook/test';
import { SubscreenExample } from './subscreen.example';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './app-header-island.example';
import { AppHeaderIsland } from './index';

const meta = {
  id: 'layouts-appheaderisland',
  title: 'Organisms/AppHeaderIsland',
  component: AppHeaderIsland,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};

/** Production shell with live screen contracts: the same hierarchy used by profile routes. */
export const Subscreen: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <SubscreenExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    if (!canvas.queryByRole('navigation', { name: 'Breadcrumb' })) return;
    await userEvent.click(canvas.getByRole('link', { name: 'Profile' }));
    await expect(canvas.getByRole('button', { name: 'Profile tab' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Edit username' }));
    await expect(canvas.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('Username');
  },
};
