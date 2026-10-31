import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX, Show } from 'solid-js';
import { SegmentedControl } from '../segmented-control/index';
import { useLayoutMode } from '../use-layout-mode';

export type InspectionTool = {
  readonly key: string;
  readonly label: string;
  readonly content: JSX.Element;
};

export type InspectionWorkspaceProps = {
  readonly primary: JSX.Element;
  readonly primaryLabel: string;
  readonly tools: readonly InspectionTool[];
  readonly toolsLabel: string;
  readonly selected: string;
  readonly onSelect: (key: string) => void;
  readonly dataSet?: ComponentDataSet;
};

/** A primary surface with inspection tools; compact screens select one pane at a time. */
export function InspectionWorkspace(props: InspectionWorkspaceProps) {
  const mode = useLayoutMode();
  const wide = () => mode() === 'wide';
  const selectedTool = () =>
    props.tools.find((tool) => tool.key === props.selected) ?? props.tools[0];
  const primaryVisible = () =>
    wide() || !props.tools.some((tool) => tool.key === props.selected);
  const segments = () => [
    ...(!wide() ? [{ key: 'primary', label: props.primaryLabel }] : []),
    ...props.tools.map((tool) => ({ key: tool.key, label: tool.label })),
  ];
  return (
    <div
      class="box flex-1 min-h-0 min-w-0 gap-4"
      classList={{ 'flex-row': wide() }}
      {...dataAttrs({ component: 'InspectionWorkspace', ...props.dataSet })}
    >
      <Show when={props.tools.length > 0}>
        <div
          class="box min-h-0 min-w-0 gap-3"
          classList={{ 'w-80 shrink-0': wide(), 'flex-1': !wide() }}
        >
          <SegmentedControl
            aria-label={props.toolsLabel}
            segments={segments()}
            selected={
              wide()
                ? (selectedTool()?.key ?? '')
                : primaryVisible()
                  ? 'primary'
                  : props.selected
            }
            onSelect={props.onSelect}
          />
          <For each={props.tools}>
            {(tool) => (
              <Show
                when={
                  selectedTool()?.key === tool.key &&
                  (wide() || !primaryVisible())
                }
              >
                <InspectionPane
                  label={tool.label}
                  content={tool.content}
                  scroll
                />
              </Show>
            )}
          </For>
          <Show when={!wide() && primaryVisible()}>
            <InspectionPane
              label={props.primaryLabel}
              content={props.primary}
            />
          </Show>
        </div>
      </Show>
      <Show when={wide() || props.tools.length === 0}>
        <InspectionPane label={props.primaryLabel} content={props.primary} />
      </Show>
    </div>
  );
}

function InspectionPane(props: {
  label: string;
  content: JSX.Element;
  scroll?: boolean;
}) {
  return (
    <section
      aria-label={props.label}
      class="box flex-1 min-h-0 min-w-0"
      classList={{
        'overflow-auto': props.scroll === true,
        'overflow-hidden': props.scroll !== true,
      }}
    >
      {props.content}
    </section>
  );
}
