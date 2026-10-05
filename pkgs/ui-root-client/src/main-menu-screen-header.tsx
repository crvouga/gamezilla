/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { type JSX, Show } from 'solid-js';

export type MainMenuScreenHeaderProps = {
  title?: JSX.Element | undefined;
  subtitle?: JSX.Element | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/** Shared title and subtitle treatment for screens inside a main-menu flow. */
export function MainMenuScreenHeader(
  props: MainMenuScreenHeaderProps
): JSX.Element {
  const hasTitle = (): boolean => props.title !== undefined;
  const hasSubtitle = (): boolean => props.subtitle !== undefined;
  return (
    <Show when={hasTitle() || hasSubtitle()}>
      <div
        class="box gap-1 items-center py-2 min-w-0 self-stretch"
        {...dataAttrs({ component: 'MainMenuScreenHeader', ...props.dataSet })}
      >
        <Show when={hasTitle()}>
          <h1 class="text textHeading text-center min-w-0 max-w-full">
            {props.title}
          </h1>
        </Show>
        <Show when={hasSubtitle()}>
          <p class="text line-clamp-2 text-center opacity-75 min-w-0 max-w-full text-text-secondary">
            {props.subtitle}
          </p>
        </Show>
      </div>
    </Show>
  );
}
