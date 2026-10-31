/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { createScreenSlot } from '../screen-slot';

export type ScreenIntroProps = {
  title?: JSX.Element | undefined;
  subtitle?: JSX.Element | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/**
 * The title block that opens a screen's body: the `h1` in the `title` role
 * (the display face, 26/30) and one quiet caption line. The only place a
 * body title is drawn, so every screen inside a host's chrome
 * (`EmbeddedScreen`) opens the same way, and the same size as a
 * `ScreenLargeTitle`.
 */
export function ScreenIntro(props: ScreenIntroProps): JSX.Element {
  const title = createScreenSlot(() => props.title);
  const subtitle = createScreenSlot(() => props.subtitle);
  return (
    <Show when={title.present() || subtitle.present()}>
      <div
        class="box gap-1 items-start py-2 min-w-0 self-stretch"
        {...dataAttrs({ component: 'ScreenIntro', ...props.dataSet })}
      >
        <Show when={title.present()}>
          <h1 class="text textTitle min-w-0 max-w-full break-words">
            {title.content()}
          </h1>
        </Show>
        <Show when={subtitle.present()}>
          <p class="text textCaption line-clamp-2 min-w-0 max-w-full">
            {subtitle.content()}
          </p>
        </Show>
      </div>
    </Show>
  );
}
