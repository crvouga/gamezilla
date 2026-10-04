import { useTimers } from '@pkgs/clock-client/solid';
import type {
  ProductHarnessLoadBalancerNode,
  ProductHarnessLoadBalancerRoute,
  ProductHarnessLoadBalancerSnapshot,
} from '@pkgs/harness-console-shared/ports';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { ScrollView } from '@pkgs/ui-root-client/scroll-view';
import { StatusDot } from '@pkgs/ui-root-client/status-dot';
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js';

function BalancerSummary(props: {
  readonly snapshot: ProductHarnessLoadBalancerSnapshot;
}) {
  return (
    <div class="box flex-row items-center gap-2 flex-wrap">
      <p class="text textCaption text-text-secondary">
        {props.snapshot.algorithm}
      </p>
      <p class="text textCaption text-text-secondary">
        {`· ${String(props.snapshot.requests)} routed`}
      </p>
      <Show when={props.snapshot.rejected > 0}>
        <p class="text textCaption text-warning">
          {`· ${String(props.snapshot.rejected)} rejected`}
        </p>
      </Show>
    </div>
  );
}

function BackendRow(props: {
  readonly id: string;
  readonly reachable: boolean;
  readonly requests: number;
  readonly next: boolean;
}) {
  return (
    <div class="box flex-row items-center gap-2 [padding-top:1.5px;padding-bottom:1.5px] border-b border-border">
      <StatusDot
        status={props.reachable ? 'online' : 'offline'}
        size={8}
        label={props.reachable ? 'reachable' : 'unreachable'}
      />
      <p class="text flex-1 text-text text-xs [font-family:mono]">{props.id}</p>
      <Show when={props.next}>
        <p class="text textCaption text-tint">{'next'}</p>
      </Show>
      <p class="text textCaption text-text-secondary">
        {`${String(props.requests)} req`}
      </p>
    </div>
  );
}

function RouteRow(props: { readonly route: ProductHarnessLoadBalancerRoute }) {
  return (
    <div class="box flex-row items-center gap-2 [padding-top:1.5px;padding-bottom:1.5px]">
      <p class="text flex-1 min-w-0 text-text-secondary text-xs [font-family:mono]">
        {`${props.route.method} ${props.route.path}`}
      </p>
      <p
        class="text textCaption [font-family:mono]"
        classList={{
          'text-warning': props.route.to === null,
          'text-text-secondary': props.route.to !== null,
        }}
      >
        {`${props.route.from} → ${props.route.to ?? 'none'}`}
      </p>
    </div>
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
    <ScrollView class="flex-1 min-h-0" contentClass="p-[6px] gap-2">
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
        <div class="box gap-0.5">
          <p class="text textLabel text-text-secondary">{'Backends'}</p>
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
        </div>
      </Show>
      <Show when={recent().length > 0}>
        <div class="box gap-0.5">
          <p class="text textLabel text-text-secondary">{'Recent routes'}</p>
          <For each={recent()}>{(route) => <RouteRow route={route} />}</For>
        </div>
      </Show>
    </ScrollView>
  );
}
