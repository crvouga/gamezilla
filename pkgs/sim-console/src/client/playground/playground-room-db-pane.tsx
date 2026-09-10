import { useTimers } from '@pkgs/clock/solid';
import { EmptyState, JsonView, ScrollView } from '@pkgs/ui';
import {
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  Show,
} from 'solid-js';

import type { PlaygroundRoomNode } from '../../shared/ports';

/**
 * Room state / event-log inspector (in-memory storage, not SQL).
 */
export function PlaygroundRoomDbPane(props: {
  readonly room: PlaygroundRoomNode;
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
        <div class="box flex-1 min-h-[0] p-[8px]">
          <EmptyState
            variant="compact"
            title="Room gone"
            body="This room topic is no longer live."
          />
        </div>
      }
    >
      {(current) => (
        <ScrollView class="flex-1 min-h-[0]" contentClass="p-[6px] gap-3">
          <Section title="Topic" body={current().topic} />
          <Section title={`Roster (${current().roster.length})`}>
            <Show
              when={current().roster.length > 0}
              fallback={
                <p class="text textCaption text-text-secondary">{'Empty'}</p>
              }
            >
              <JsonView value={current().roster} initialExpandDepth={1} />
            </Show>
          </Section>
          <Section
            title={`Log (seq ${current().lastSeq}, dedup ${current().dedupSize})`}
          >
            <Show
              when={current().entries.length > 0}
              fallback={
                <p class="text textCaption text-text-secondary">
                  {'No events'}
                </p>
              }
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
    <div class="box gap-1">
      <p class="text text-text-secondary text-[11px] font-semibold">
        {props.title}
      </p>
      {props.body !== undefined ? (
        <p class="text text-text text-[12px] [font-family:mono]">
          {props.body}
        </p>
      ) : null}
      {props.children}
    </div>
  );
}
