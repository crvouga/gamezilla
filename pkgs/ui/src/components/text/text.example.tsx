/** @jsxImportSource solid-js */
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';

const variants = [
  'body',
  'bodyBold',
  'caption',
  'label',
  'title',
  'subtitle',
  'heading',
  'navigationTitle',
  'link',
  'mono',
] as const;

export default function TextExample(): JSX.Element {
  return (
    <ExampleRoot class="gap-3">
      <For each={variants}>
        {(v) => (
          <div class="box gap-0.5">
            <p class="text textCaption">{v}</p>
            <p
              class="text"
              classList={{
                textBodyBold: v === 'bodyBold',
                textCaption: v === 'caption',
                textLabel: v === 'label',
                textTitle: v === 'title',
                textSubtitle: v === 'subtitle',
                textHeading: v === 'heading',
                textNavigationTitle: v === 'navigationTitle',
                textLink: v === 'link',
                textMono: v === 'mono',
              }}
            >
              {'The quick brown fox jumps over the lazy dog'}
            </p>
          </div>
        )}
      </For>
      <p class="text text-text-secondary">{'Custom color override'}</p>
      <div class="box gap-0.5">
        <p class="text textCaption">{'Empty string (reserves line height)'}</p>
        <p class="text">{''}</p>
        <p class="text">{'Filled after load'}</p>
      </div>
    </ExampleRoot>
  );
}
