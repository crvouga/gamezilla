import { boardArgs } from '@libs/game-session-client-ts/game-frame-table.example';
import { heartsRules } from '@libs/hearts-shared-ts/hearts-rules';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { HeartsBoard } from './hearts-board';
import { renderPassJourney } from './hearts-pass-journey.example';

const meta = {
  id: 'screens-games-hearts-interaction',
  title: 'Screens/Games/Hearts/Passing into play',
  component: HeartsBoard,
  args: boardArgs(heartsRules.initial()),
  parameters: { appRouter: true, controls: { disable: true } },
  render: (_args, context) => renderPassJourney(context),
} satisfies Meta<typeof HeartsBoard>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A deterministic exchange and trick for trusted touch, mouse and keyboard input.
 * The fixture rotates the viewer through the four players, using the real
 * legal-card rules. It does not emulate server transport or persistence.
 */
export const PassAndPlay: Story = {};
