import { useTimers } from '@pkgs/clock/solid';
import { Box, EmptyState, JsonView, ScrollView, Text } from '@pkgs/ui';
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
        <Box sx={{ flex: 1, minHeight: 0, padding: 8 }}>
          <EmptyState
            variant="compact"
            title="Room gone"
            body="This room topic is no longer live."
          />
        </Box>
      }
    >
      {(current) => (
        <ScrollView
          frameSx={{ flex: 1, minHeight: 0 }}
          sx={{ padding: 6, gap: 3 }}
        >
          <Section title="Topic" body={current().topic} />
          <Section title={`Roster (${current().roster.length})`}>
            <Show
              when={current().roster.length > 0}
              fallback={
                <Text
                  variant="caption"
                  label="Empty"
                  sx={{ color: 'textSecondary' }}
                />
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
                <Text
                  variant="caption"
                  label="No events"
                  sx={{ color: 'textSecondary' }}
                />
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
    <Box sx={{ gap: 1 }}>
      <Text
        sx={{ color: 'textSecondary', fontSize: 11, fontWeight: '600' }}
        label={props.title}
      />
      {props.body !== undefined ? (
        <Text
          sx={{ color: 'text', fontSize: 12, fontFamily: 'mono' }}
          label={props.body}
        />
      ) : null}
      {props.children}
    </Box>
  );
}
