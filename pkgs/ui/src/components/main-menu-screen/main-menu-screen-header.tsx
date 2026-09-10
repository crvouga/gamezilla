/** @jsxImportSource solid-js */
import { type JSX, Show } from 'solid-js';
import { type ComponentDataSet, dataAttrs } from '../../component-id';

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
        class="box gap-1 items-center py-2"
        {...dataAttrs({ component: 'MainMenuScreenHeader', ...props.dataSet })}
      >
        <Show when={hasTitle()}>
          <h1 class="text textHeading text-center">{props.title}</h1>
        </Show>
        <Show when={hasSubtitle()}>
          <p class="text text-text-secondary text-center opacity-75">
            {props.subtitle}
          </p>
        </Show>
      </div>
    </Show>
  );
}
