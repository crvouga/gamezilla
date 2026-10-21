import { useTimers } from '@pkgs/clock-client-ts/solid';
import type { ProductHarnessRoomNode } from '@pkgs/harness-console-shared-ts/ports';
import { JsonView } from '@pkgs/ui-devtools-client-ts/json-view';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { ScrollView } from '@pkgs/ui-root-client-ts/scroll-view';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import {
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  Show,
} from 'solid-js';

/**
 * Room state / event-log inspector (in-memory storage, not SQL).
 */
export function ProductHarnessRoomDbPane(props: {
  readonly room: ProductHarnessRoomNode;
  readonly subscribe: (listener: () => void) => () => void;
}) {
  const timers = useTimers();
  const [snap, setSnap] = createSignal(props.room.inspect());

  createEffect(() => {
    const { room, subscribe } = props;
    const refresh = () => setSnap(room.inspect());
    refresh();
    const unsub = subscribe(refresh);
    const handle = timers.setInterval(refresh, 500);
    onCleanup(() => {
      unsub();
      timers.clearInterval(handle);
    });
  });

  return (
    <Show
      when={snap()}
      fallback={
        <StackVertical grow padding="sm">
          <EmptyState
            variant="compact"
            title="Room gone"
            body="This room topic is no longer live."
          />
        </StackVertical>
      }
    >
      {(current) => (
        <ScrollView grow padding="md" gap="lg">
          <Section title="Topic" body={current().topic} />
          <Section title={`Roster (${current().roster.length})`}>
            <Show
              when={current().roster.length > 0}
              fallback={<P variant="caption">{'Empty'}</P>}
            >
              <JsonView value={current().roster} initialExpandDepth={1} />
            </Show>
          </Section>
          <Section
            title={`Log (seq ${current().lastSeq}, dedup ${current().dedupSize})`}
          >
            <Show
              when={current().entries.length > 0}
              fallback={<P variant="caption">{'No events'}</P>}
            >
              <JsonView value={current().entries} initialExpandDepth={2} />
            </Show>
          </Section>
          <Section title="Committed state">
            <JsonView value={current().committedState} initialExpandDepth={2} />
          </Section>
        </ScrollView>
      )}
    </Show>
  );
}

function Section(props: {
  readonly title: string;
  readonly body?: string;
  readonly children?: JSX.Element;
}) {
  return (
    <StackVertical gap="xs">
      <P variant="footnote">{props.title}</P>
      {props.body !== undefined ? (
        <P variant="mono" wrap="break" selectable>
          {props.body}
        </P>
      ) : null}
      {props.children}
    </StackVertical>
  );
}
