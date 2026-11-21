/** @jsxImportSource solid-js */

import { Button } from '@pkgs/ui-root-client-ts/button';
import { ResponsiveSurface } from '@pkgs/ui-root-client-ts/responsive-surface';
import type { ModalSize } from '@pkgs/ui-root-shared-ts/modal-size';
import { createSignal, For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

const SIZES: readonly ModalSize[] = ['small', 'medium', 'large', 'fullWidth'];

type OpenSurface = ModalSize | 'untitled' | 'locked';

export default function ResponsiveSurfaceExample(): JSX.Element {
  const [openSize, setOpenSize] = createSignal<OpenSurface | null>(null);

  return (
    <ExampleRoot>
      <p class="text textCaption">
        {
          'Compact: a bottom sheet on raised paper with a 20px top radius, a grab handle, the float shadow and the safe-area inset. Wide: a centered dialog on the scrim, 20px radius, the float shadow.'
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
              {
                'Surface body. Close via X, backdrop click, or swipe down (mobile).'
              }
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
