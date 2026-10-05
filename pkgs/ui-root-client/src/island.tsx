/** @jsxImportSource solid-js */
/**
 * `Island` -- flat content section for the wide app shell. Transparent (no
 * card chrome). On compact layouts it is a pass-through so screens keep their
 * mobile spacing.
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { ISLAND_PADDING_STEP } from '@pkgs/ui-root-shared/layout';
import { spacingScale } from '@pkgs/ui-root-shared/scale';
import { type JSX, Show, splitProps } from 'solid-js';
import { ContentEdgePaddingProvider } from './content-edge-padding';
import { useLayoutMode } from './use-layout-mode';

export type IslandSpan = 1 | 2 | 3;

export type IslandProps = {
  title?: JSX.Element | undefined;
  caption?: JSX.Element | undefined;
  /** Trailing actions in the title row (wide only). */
  actions?: JSX.Element | undefined;
  /** Columns spanned inside an `IslandGrid` (wide only). Defaults to 1. */
  span?: IslandSpan | undefined;
  class?: string | undefined;
  style?: JSX.CSSProperties | undefined;
  children?: JSX.Element | undefined;
  dataSet?: ComponentDataSet | undefined;
};

function IslandTitleRow(props: {
  title: JSX.Element;
  caption: JSX.Element | undefined;
  actions: JSX.Element | undefined;
}): JSX.Element {
  return (
    <div class="box flex-row items-center gap-2 mb-3">
      <div class="box flex-1 min-w-0 gap-0.5">
        <h2 class="text textSubtitle">{props.title}</h2>
        <Show when={props.caption !== undefined && props.caption !== null}>
          <p class="text textCaption text-text-secondary">{props.caption}</p>
        </Show>
      </div>
      {props.actions}
    </div>
  );
}

function IslandWide(props: IslandProps): JSX.Element {
  const hasTitle = () => props.title !== undefined && props.title !== null;
  return (
    <section
      class="box bg-transparent overflow-hidden"
      classList={{ [String(props.class)]: true }}
      {...dataAttrs({ component: 'Island', ...props.dataSet })}
      style={{
        padding: `${spacingScale(ISLAND_PADDING_STEP)}px`,
        'grid-column': `span ${props.span ?? 1}`,
        ...props.style,
      }}
    >
      <ContentEdgePaddingProvider step={ISLAND_PADDING_STEP}>
        <Show when={hasTitle()}>
          <IslandTitleRow
            title={props.title}
            caption={props.caption}
            actions={props.actions}
          />
        </Show>
        {props.children}
      </ContentEdgePaddingProvider>
    </section>
  );
}

export function Island(props: IslandProps): JSX.Element {
  const mode = useLayoutMode();
  const [local, rest] = splitProps(props, [
    'title',
    'caption',
    'actions',
    'span',
    'class',
    'style',
    'children',
    'dataSet',
  ]);
  return (
    <Show
      when={mode() === 'wide'}
      fallback={
        <div
          class="box"
          classList={{ [String(local.class)]: true }}
          {...dataAttrs({ component: 'Island', ...local.dataSet })}
          style={local.style}
        >
          {local.children}
        </div>
      }
    >
      <IslandWide {...local} {...rest} />
    </Show>
  );
}
