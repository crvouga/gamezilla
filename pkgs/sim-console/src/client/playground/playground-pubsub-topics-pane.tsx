import { useTimers } from '@pkgs/clock/solid';
import { Box, EmptyState, ScrollView, Text } from '@pkgs/ui';
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js';

import type { PlaygroundPubSubNode } from '../../shared/ports';

/**
 * Live pubsub topic inventory across in-memory bus peers.
 */
export function PlaygroundPubSubTopicsPane(props: {
  readonly pubsub: PlaygroundPubSubNode;
  readonly subscribe: (listener: () => void) => () => void;
}) {
  const timers = useTimers();
  const [stats, setStats] = createSignal(props.pubsub.listTopicStats());

  createEffect(() => {
    const { pubsub, subscribe } = props;
    const refresh = () => setStats(pubsub.listTopicStats());
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
      when={stats().length > 0}
      fallback={
        <Box sx={{ flex: 1, minHeight: 0, padding: 8 }}>
          <EmptyState
            variant="compact"
            title="No topics"
            body="Subscribed topics across pubsub peers will appear here."
          />
        </Box>
      }
    >
      <ScrollView
        frameSx={{ flex: 1, minHeight: 0 }}
        sx={{ padding: 6, gap: 1 }}
      >
        <For each={stats()}>
          {(row) => (
            <Box
              sx={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 2,
                paddingVertical: 1.5,
                borderBottomWidth: 1,
                borderColor: 'border',
              }}
            >
              <Text
                sx={{
                  flex: 1,
                  color: 'text',
                  fontSize: 12,
                  fontFamily: 'mono',
                }}
                label={row.topic}
              />
              <Text
                variant="caption"
                label={`${row.subscriberCount} sub`}
                sx={{ color: 'textSecondary' }}
              />
              <Text
                variant="caption"
                label={`${row.instanceCount} peer`}
                sx={{ color: 'textSecondary' }}
              />
            </Box>
          )}
        </For>
      </ScrollView>
    </Show>
  );
}
