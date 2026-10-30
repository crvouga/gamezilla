import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PaddleCourt } from './index';
import Example from './paddle-court.example';

const meta = {
  id: 'components-inputs-paddlecourt',
  title: 'Games/Pong/Court',
  component: PaddleCourt,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
