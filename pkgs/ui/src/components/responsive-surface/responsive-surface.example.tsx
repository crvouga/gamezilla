/** @jsxImportSource solid-js */
import { createSignal, For, type JSX } from 'solid-js';
import type { ModalSize } from '../../theme/modal-size';
import { Button } from '../button';
import { ExampleRoot } from '../explorer/example-root';
import { ResponsiveSurface } from './responsive-surface';

const SIZES: readonly ModalSize[] = ['small', 'medium', 'large', 'fullWidth'];

type OpenSurface = ModalSize | 'untitled';

export default function ResponsiveSurfaceExample(): JSX.Element {
  const [openSize, setOpenSize] = createSignal<OpenSurface | null>(null);

  return (
    <ExampleRoot>
      <p class="text textCaption opacity-75">
        {
          'On mobile: bottom sheet. On tablet/desktop: centered modal with a width bucket. Every surface shows a top-right close control.'
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
          onClick={() => setOpenSize('untitled')}
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
    </ExampleRoot>
  );
}
