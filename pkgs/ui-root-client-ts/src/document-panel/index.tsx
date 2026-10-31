import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';

export type DocumentPanelProps = {
  readonly title: JSX.Element;
  readonly caption?: JSX.Element;
  readonly content: string;
  readonly actions?: JSX.Element;
  readonly dataSet?: ComponentDataSet;
};

/** Readable source with native text selection, wrapping and no executable markup. */
export function DocumentPanel(props: DocumentPanelProps): JSX.Element {
  return (
    <section
      class="box gap-3 min-w-0"
      {...dataAttrs({ component: 'DocumentPanel', ...props.dataSet })}
    >
      <div class="box flex-row flex-wrap items-start gap-3">
        <div class="box flex-1 min-w-0 gap-1">
          <h2 class="text textSubtitle">{props.title}</h2>
          <Show when={props.caption}>
            <p class="text textCaption break-words">{props.caption}</p>
          </Show>
        </div>
        {props.actions}
      </div>
      <pre class="text textMono whitespace-pre-wrap break-words bg-surface rounded-card p-4 m-0">
        {props.content}
      </pre>
    </section>
  );
}
