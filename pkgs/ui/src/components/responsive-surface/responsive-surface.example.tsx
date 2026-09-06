/** @jsxImportSource solid-js */
import { createSignal, For, type JSX } from 'solid-js';
import type { ModalSize } from '../../theme/modal-size';
import { Button } from '../button';
import { ExampleRoot } from '../explorer/example-root';
import { Stack } from '../stack';
import { Text } from '../text';
import { ResponsiveSurface } from './responsive-surface';

const SIZES: readonly ModalSize[] = ['small', 'medium', 'large', 'fullWidth'];

type OpenSurface = ModalSize | 'untitled';

export default function ResponsiveSurfaceExample(): JSX.Element {
  const [openSize, setOpenSize] = createSignal<OpenSurface | null>(null);

  return (
    <ExampleRoot>
      <Text
        variant="caption"
        sx={{ opacity: 0.75 }}
        label="On mobile: bottom sheet. On tablet/desktop: centered modal with a width bucket. Every surface shows a top-right close control."
      />
      <Stack spacing={2}>
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
      </Stack>
      <For each={SIZES}>
        {(size) => (
          <ResponsiveSurface
            visible={openSize() === size}
            onClose={() => setOpenSize(null)}
            title={`Size: ${size}`}
            size={size}
          >
            <Text
              variant="body"
              label="Surface body. Close via X, backdrop click, or swipe down (mobile)."
            />
          </ResponsiveSurface>
        )}
      </For>
      <ResponsiveSurface
        visible={openSize() === 'untitled'}
        onClose={() => setOpenSize(null)}
        size="medium"
      >
        <Text
          variant="body"
          label="Untitled surface — close control only in the header."
        />
      </ResponsiveSurface>
    </ExampleRoot>
  );
}
