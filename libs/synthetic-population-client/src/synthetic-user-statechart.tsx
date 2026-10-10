import { behaviorStatechart } from '@libs/synthetic-population-shared/behavior-statechart';
import type { Inspection } from '@libs/synthetic-population-shared/inspection';
import { Trans, useLingui } from '@lingui/solid/macro';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { createMemo, For, type JSX, Show } from 'solid-js';

type BehaviorNode = typeof behaviorStatechart.root;
type BehaviorSnapshot = ReturnType<typeof behaviorStatechart.resolveState>;
type BehaviorPattern = Parameters<BehaviorSnapshot['matches']>[0];
type BehaviorValue = Parameters<
  typeof behaviorStatechart.resolveState
>[0]['value'];

function BehaviorState(props: {
  node: BehaviorNode;
  active: () => BehaviorSnapshot | null;
}): JSX.Element {
  const { t } = useLingui();
  const selected = () =>
    props.active()?.matches(props.node.path.join('.') as BehaviorPattern) ??
    false;
  return (
    <>
      <MenuRow
        title={props.node.key}
        value={selected() ? t`Current` : ''}
        selected={selected()}
        dataSet={{
          testid: `synthetic-population-state-${props.node.path.join('-')}`,
        }}
      />
      <Show when={Object.keys(props.node.states).length > 0}>
        <div class="box pl-3 border-l border-border">
          <For each={Object.values(props.node.states)}>
            {(node) => <BehaviorState node={node} active={props.active} />}
          </For>
        </div>
      </Show>
    </>
  );
}

export function SyntheticUserStatechart(props: {
  activity: string;
  snapshot: Inspection | null;
}): JSX.Element {
  const active = createMemo(() => {
    try {
      return behaviorStatechart.resolveState({
        value: (props.snapshot === null
          ? props.activity
          : JSON.parse(props.snapshot.state)) as BehaviorValue,
      });
    } catch {
      return null;
    }
  });
  return (
    <MenuSection title={<Trans>Behavior Statechart</Trans>}>
      <For each={Object.values(behaviorStatechart.root.states)}>
        {(node) => <BehaviorState node={node} active={active} />}
      </For>
      <Show when={props.snapshot}>
        {(snapshot) => (
          <>
            <MenuRow
              title={<Trans>Active state</Trans>}
              value={snapshot().state}
            />
            <MenuRow
              title={<Trans>Available transitions</Trans>}
              value={snapshot().transitions.join(', ')}
            />
          </>
        )}
      </Show>
    </MenuSection>
  );
}
