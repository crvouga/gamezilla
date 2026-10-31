import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { P } from '../text/index';
import { FadeSwitch } from './index';
export default {
  id: 'patterns-fadeswitch',
  title: 'Organisms/Patterns/FadeSwitch',
  component: FadeSwitch,
  tags: ['autodocs'],
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof FadeSwitch>;
export const Ready: StoryObj = {
  render: () => (
    <FadeSwitch stateKey="ready">
      <P>Ready to play</P>
    </FadeSwitch>
  ),
};
