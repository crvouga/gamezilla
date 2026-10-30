import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { P } from '../text/index';
import { FadeSwitch } from './index';
export default {
  title: 'Patterns/FadeSwitch',
  component: FadeSwitch,
  tags: ['autodocs'],
} satisfies Meta<typeof FadeSwitch>;
export const Ready: StoryObj = {
  render: () => (
    <FadeSwitch stateKey="ready">
      <P>Ready to play</P>
    </FadeSwitch>
  ),
};
