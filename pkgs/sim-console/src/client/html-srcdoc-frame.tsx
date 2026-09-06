import { Box } from '@pkgs/ui';
import { Show } from 'solid-js';
import { HtmlPaneEmpty } from './html-pane-empty';

/** Prepared report markup is scoped to this host by prepareSnapshotHtml. */
export function HtmlSrcdocFrame(props: {
  readonly title: string;
  readonly srcdoc: string | null;
}) {
  return (
    <Show when={props.srcdoc} fallback={<HtmlPaneEmpty kind="blank" />}>
      <Box
        class="snapshot-host"
        title={props.title}
        sx={{
          position: 'relative',
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          background: 'background',
        }}
        innerHTML={props.srcdoc ?? ''}
      />
    </Show>
  );
}
