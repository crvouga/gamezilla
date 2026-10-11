/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { type JSX, Show } from 'solid-js';

export type ScreenIntroProps = {
  title?: JSX.Element | undefined;
  subtitle?: JSX.Element | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/**
 * The title block that opens a screen's body: the `h1` and one quiet line.
 * The only place a body title is drawn, so every screen inside a host's
 * chrome (`EmbeddedScreen`) opens the same way.
 */
export function ScreenIntro(props: ScreenIntroProps): JSX.Element {
  const hasTitle = (): boolean => props.title !== undefined;
  const hasSubtitle = (): boolean => props.subtitle !== undefined;
  return (
    <Show when={hasTitle() || hasSubtitle()}>
      <div
        class="box gap-1 items-start py-2 min-w-0 self-stretch"
        {...dataAttrs({ component: 'ScreenIntro', ...props.dataSet })}
      >
        <Show when={hasTitle()}>
          <h1 class="text textHeading min-w-0 max-w-full">{props.title}</h1>
        </Show>
        <Show when={hasSubtitle()}>
          <p class="text textCaption line-clamp-2 min-w-0 max-w-full">
            {props.subtitle}
          </p>
        </Show>
      </div>
    </Show>
  );
}
