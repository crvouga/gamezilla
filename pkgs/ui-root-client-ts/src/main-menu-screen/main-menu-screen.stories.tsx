import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MainMenuScreen } from './index';
import Example from './main-menu-screen.example';

const meta = {
  id: 'templates-main-menu',
  title: 'Templates/Main menu',
  component: MainMenuScreen,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
