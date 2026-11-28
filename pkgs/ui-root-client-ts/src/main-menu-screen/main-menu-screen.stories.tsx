import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MainMenuScreen } from './index';
import Example from './main-menu-screen.example';

const meta = {
  id: 'templates-main-menu',
  title: 'Templates/MainMenuScreen',
  component: MainMenuScreen,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
