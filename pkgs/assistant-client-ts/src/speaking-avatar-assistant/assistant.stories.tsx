import { emitAssistantSpeakingMessage } from '@pkgs/assistant-client-ts/assistant-speaking-bridge';
import { createNoopRenderer } from '@pkgs/assistant-client-ts/noop-renderer';
import { createSystemClock } from '@pkgs/assistant-client-ts/system-clock';
import { createAssistant } from '@pkgs/assistant-shared-ts/engine';
import { useClockContext } from '@pkgs/clock-client-ts/solid';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SpeakingAvatarAssistant } from './index';

export default {
  id: 'product-assistant',
  title: 'Organisms/Assistant',
  component: SpeakingAvatarAssistant,
  tags: ['autodocs'],
  parameters: { controls: { disable: true } },
} satisfies Meta;
function AssistantFixture() {
  const assistant = createAssistant({
    adapter: { proposeCandidates: () => [] },
    renderer: createNoopRenderer(),
    clock: createSystemClock(useClockContext()),
    seed: 'storybook-assistant',
  });
  return (
    <StackVertical gap="md">
      <SpeakingAvatarAssistant assistant={assistant} speak={false} />
      <Button
        title="Show hint"
        onClick={() =>
          emitAssistantSpeakingMessage(
            assistant,
            'First, look for a safe move.'
          )
        }
      />
      <Button
        title="Prepare hint"
        onClick={() =>
          emitAssistantSpeakingMessage(assistant, null, {
            bubbleResolving: true,
          })
        }
      />
    </StackVertical>
  );
}
export const Idle: StoryObj = { render: () => <AssistantFixture /> };
export const Hint: StoryObj = {
  render: () => <AssistantFixture />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Show hint' }));
    canvasElement.dispatchEvent(
      new CustomEvent('advance-story-time', { detail: 10000 })
    );
    await expect(
      canvas.getByText('First, look for a safe move.')
    ).toBeInTheDocument();
  },
};
export const Resolving: StoryObj = {
  render: () => <AssistantFixture />,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Prepare hint' })
    );
  },
};
