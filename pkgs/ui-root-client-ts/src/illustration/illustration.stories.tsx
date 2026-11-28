import { For } from 'solid-js';
import { expect } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import * as artwork from './index';
import { FriendsArt } from './index';

export default {
  id: 'components-illustration',
  title: 'Atoms/Illustration',
  component: FriendsArt,
} satisfies Meta;

export const Catalog: StoryObj = {
  render: () => (
    <ExampleRoot>
      <div class="box flex-row flex-wrap gap-4">
        <For each={Object.entries(artwork)}>
          {([name, Art]) => (
            <div class="box items-center gap-1">
              <Art />
              <span class="text textCaption">{name.replace(/Art$/, '')}</span>
            </div>
          )}
        </For>
      </div>
    </ExampleRoot>
  ),
  play: async ({ canvasElement }) => {
    const pictures = canvasElement.querySelectorAll('img');
    await expect(pictures).toHaveLength(Object.keys(artwork).length);
    for (const picture of pictures) {
      await picture.decode();
      await expect(picture.naturalWidth).toBeGreaterThan(0);
      await expect(picture).toHaveAttribute('alt', '');
      await expect(picture).toHaveAttribute('aria-hidden', 'true');
      await expect(picture.width).toBe(32);
    }
  },
};
