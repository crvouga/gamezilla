/** @jsxImportSource @solidjs/web */

import { Button } from '@pkgs/ui-root-client-ts/button';
import { ResponsiveSurface } from '@pkgs/ui-root-client-ts/responsive-surface';
import type { ModalSize } from '@pkgs/ui-root-shared-ts/modal-size';
import type { JSX } from '@solidjs/web';
import { createSignal, For } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

const SIZES: readonly ModalSize[] = ['small', 'medium', 'large', 'fullWidth'];

type OpenSurface = ModalSize | 'untitled' | 'locked';

export default function ResponsiveSurfaceExample(): JSX.Element {
  const [openSize, setOpenSize] = createSignal<OpenSurface | null>(null);

  return (
    <ExampleRoot>
      <p class="text textCaption">
        {
          'A modal centered on the scrim at every width: raised paper, 20px radius, the float shadow. Compact layouts use the whole width inside a 16px margin; wide layouts use the size bucket. Long content scrolls inside the modal.'
        }
      </p>
      <div class="box flex-col gap-2">
        <For each={SIZES}>
          {(size) => (
            <Button
              title={`Open — ${size}`}
              onClick={() => setOpenSize(size)}
            />
          )}
        </For>
        <Button
          title="Open — untitled (close only)"
          intent="neutral"
          onClick={() => setOpenSize('untitled')}
        />
        <Button
          title="Open — not closable"
          intent="neutral"
          onClick={() => setOpenSize('locked')}
        />
      </div>
      <For each={SIZES}>
        {(size) => (
          <ResponsiveSurface
            visible={openSize() === size}
            onClose={() => setOpenSize(null)}
            title={`Size: ${size}`}
            size={size}
          >
            <p class="text">
              {'Surface body. Close via X, backdrop click, or Escape.'}
            </p>
          </ResponsiveSurface>
        )}
      </For>
      <ResponsiveSurface
        visible={openSize() === 'untitled'}
        onClose={() => setOpenSize(null)}
        size="medium"
      >
        <p class="text">
          {'Untitled surface — close control only in the header.'}
        </p>
      </ResponsiveSurface>
      <ResponsiveSurface
        visible={openSize() === 'locked'}
        onClose={() => setOpenSize(null)}
        title="Finishing up"
        closable={false}
      >
        <div class="box gap-4">
          <p class="text textBody text-text-secondary">
            {'No close control, scrim or Escape dismissal; the app closes it.'}
          </p>
          <Button title="Done" onClick={() => setOpenSize(null)} />
        </div>
      </ResponsiveSurface>
    </ExampleRoot>
  );
}
