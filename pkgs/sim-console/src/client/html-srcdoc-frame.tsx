import { Show } from 'solid-js';
import { HtmlPaneEmpty } from './html-pane-empty';

/** Prepared report markup is scoped to this host by prepareSnapshotHtml. */
export function HtmlSrcdocFrame(props: {
  readonly title: string;
  readonly srcdoc: string | null;
}) {
  return (
    <Show when={props.srcdoc} fallback={<HtmlPaneEmpty kind="blank" />}>
      <div
        class="box relative flex-1 min-w-[0] min-h-[0] w-[100%] h-[100%] overflow-hidden bg-background snapshot-host"
        title={props.title}
        innerHTML={props.srcdoc ?? ''}
      />
    </Show>
  );
}
