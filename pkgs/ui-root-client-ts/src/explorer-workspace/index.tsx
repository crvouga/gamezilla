import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { Button } from '../button/index';
import { useLayoutMode } from '../use-layout-mode';

export type ExplorerWorkspaceProps = {
  readonly master: JSX.Element;
  readonly detail: JSX.Element;
  readonly masterLabel: string;
  readonly detailLabel: string;
  readonly selected: boolean;
  readonly backLabel: JSX.Element;
  readonly onBack: () => void;
  readonly dataSet?: ComponentDataSet;
};

/** Two independently scrolling regions on wide screens; one task at a time on compact screens. */
export function ExplorerWorkspace(props: ExplorerWorkspaceProps): JSX.Element {
  const mode = useLayoutMode();
  const wide = () => mode() === 'wide';
  return (
    <div
      class="box flex-1 min-h-0 min-w-0 gap-6"
      classList={{ 'flex-row': wide() }}
      {...dataAttrs({ component: 'ExplorerWorkspace', ...props.dataSet })}
    >
      <Show when={wide() || !props.selected}>
        <section
          aria-label={props.masterLabel}
          class="box min-h-0 min-w-0 gap-3"
          classList={{ 'w-80 shrink-0': wide(), 'flex-1': !wide() }}
        >
          {props.master}
        </section>
      </Show>
      <Show when={wide() || props.selected}>
        <section
          aria-label={props.detailLabel}
          class="box flex-1 min-h-0 min-w-0 gap-3"
        >
          <Show when={!wide()}>
            <div class="box items-start">
              <Button
                title={props.backLabel}
                onClick={props.onBack}
                variant="ghost"
                size="sm"
              />
            </div>
          </Show>
          {props.detail}
        </section>
      </Show>
    </div>
  );
}
