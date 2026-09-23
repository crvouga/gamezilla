import { useTimers } from '@pkgs/clock/solid';
import { EmptyState, ScrollView } from '@pkgs/ui';
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js';

import type { ProductSimulatorPubSubNode } from '../../shared/ports';

/**
 * Live pubsub topic inventory across in-memory bus peers.
 */
export function ProductSimulatorPubSubTopicsPane(props: {
  readonly pubsub: ProductSimulatorPubSubNode;
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
        <div class="box flex-1 min-h-0 p-[8px]">
          <EmptyState
            variant="compact"
            title="No topics"
            body="Subscribed topics across pubsub peers will appear here."
          />
        </div>
      }
    >
      <ScrollView class="flex-1 min-h-0" contentClass="p-[6px] gap-1">
        <For each={stats()}>
          {(row) => (
            <div class="box flex-row items-center gap-2 [padding-top:1.5px;padding-bottom:1.5px] border-b border-border">
              <p class="text flex-1 text-text text-xs [font-family:mono]">
                {row.topic}
              </p>
              <p class="text textCaption text-text-secondary">{`${row.subscriberCount} sub`}</p>
              <p class="text textCaption text-text-secondary">{`${row.instanceCount} peer`}</p>
            </div>
          )}
        </For>
      </ScrollView>
    </Show>
  );
}
