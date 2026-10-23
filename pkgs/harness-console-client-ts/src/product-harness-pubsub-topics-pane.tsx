import { useTimers } from '@pkgs/clock-client-ts/solid';
import type { ProductHarnessPubSubNode } from '@pkgs/harness-console-shared-ts/ports';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { ScrollView } from '@pkgs/ui-root-client-ts/scroll-view';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js';
import { InspectorRow, InspectorSection } from './inspector-row';

/**
 * Live pubsub topic inventory across in-memory bus peers.
 */
export function ProductHarnessPubSubTopicsPane(props: {
  readonly pubsub: ProductHarnessPubSubNode;
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
        <StackVertical grow padding="sm">
          <EmptyState
            variant="compact"
            title="No topics"
            body="Subscribed topics across pubsub peers will appear here."
          />
        </StackVertical>
      }
    >
      <ScrollView grow padding="md">
        <InspectorSection title="Topics">
          <For each={stats()}>
            {(row) => (
              <InspectorRow
                label={row.topic}
                trailing={
                  <>
                    <P variant="footnote" numeral>
                      {`${row.subscriberCount} sub`}
                    </P>
                    <P variant="footnote" numeral>
                      {`${row.instanceCount} peer`}
                    </P>
                  </>
                }
              />
            )}
          </For>
        </InspectorSection>
      </ScrollView>
    </Show>
  );
}
