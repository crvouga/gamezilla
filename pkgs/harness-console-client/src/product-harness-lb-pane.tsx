import { useTimers } from '@pkgs/clock-client/solid';
import type {
  ProductHarnessLoadBalancerNode,
  ProductHarnessLoadBalancerRoute,
  ProductHarnessLoadBalancerSnapshot,
} from '@pkgs/harness-console-shared/ports';
import { Badge } from '@pkgs/ui-root-client/badge';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { ScrollView } from '@pkgs/ui-root-client/scroll-view';
import { StackHorizontal } from '@pkgs/ui-root-client/stack';
import { StatusDot } from '@pkgs/ui-root-client/status-dot';
import { P } from '@pkgs/ui-root-client/text';
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js';
import { InspectorRow, InspectorSection } from './inspector-row';

function BalancerSummary(props: {
  readonly snapshot: ProductHarnessLoadBalancerSnapshot;
}) {
  return (
    <StackHorizontal align="center" gap="sm" wrap>
      <Badge label={props.snapshot.algorithm} intent="neutral" size="sm" />
      <P variant="footnote" numeral>
        {`${String(props.snapshot.requests)} routed`}
      </P>
      <Show when={props.snapshot.rejected > 0}>
        <P variant="footnote" tone="warning" numeral>
          {`${String(props.snapshot.rejected)} rejected`}
        </P>
      </Show>
    </StackHorizontal>
  );
}

function BackendRow(props: {
  readonly id: string;
  readonly reachable: boolean;
  readonly requests: number;
  readonly next: boolean;
}) {
  return (
    <InspectorRow
      label={props.id}
      leading={
        <StatusDot
          status={props.reachable ? 'online' : 'offline'}
          size={8}
          label={props.reachable ? 'reachable' : 'unreachable'}
        />
      }
      trailing={
        <>
          <Show when={props.next}>
            <Badge label="next" intent="brand" size="sm" />
          </Show>
          <P variant="footnote" numeral>
            {`${String(props.requests)} req`}
          </P>
        </>
      }
    />
  );
}

function RouteRow(props: { readonly route: ProductHarnessLoadBalancerRoute }) {
  return (
    <InspectorRow
      secondary
      label={`${props.route.method} ${props.route.path}`}
      trailing={
        <P
          variant="mono"
          tone={props.route.to === null ? 'warning' : 'secondary'}
        >
          {`${props.route.from} → ${props.route.to ?? 'none'}`}
        </P>
      }
    />
  );
}

/**
 * Round-robin balancer inspector: which instances are in the rotation, which
 * one is up next, and the most recent routing decisions.
 */
export function ProductHarnessLoadBalancerPane(props: {
  readonly loadBalancer: ProductHarnessLoadBalancerNode;
  readonly subscribe: (listener: () => void) => () => void;
}) {
  const timers = useTimers();
  const [snapshot, setSnapshot] = createSignal(props.loadBalancer.inspect());

  createEffect(() => {
    const { loadBalancer, subscribe } = props;
    const refresh = () => setSnapshot(loadBalancer.inspect());
    refresh();
    const unsub = subscribe(refresh);
    const handle = timers.setInterval(refresh, 500);
    onCleanup(() => {
      unsub();
      timers.clearInterval(handle);
    });
  });

  const recent = () => [...snapshot().recentRoutes].reverse();

  return (
    <ScrollView grow padding="md" gap="lg">
      <BalancerSummary snapshot={snapshot()} />
      <Show
        when={snapshot().backends.length > 0}
        fallback={
          <EmptyState
            variant="compact"
            title="No backends"
            body="Add a server node to put an instance in the rotation."
          />
        }
      >
        <InspectorSection title="Backends">
          <For each={snapshot().backends}>
            {(backend, index) => (
              <BackendRow
                id={backend.id}
                reachable={backend.reachable}
                requests={backend.requests}
                next={index() === snapshot().cursor}
              />
            )}
          </For>
        </InspectorSection>
      </Show>
      <Show when={recent().length > 0}>
        <InspectorSection title="Recent routes">
          <For each={recent()}>{(route) => <RouteRow route={route} />}</For>
        </InspectorSection>
      </Show>
    </ScrollView>
  );
}
