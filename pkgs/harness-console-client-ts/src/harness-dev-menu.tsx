import type { HarnessPanelRef } from '@pkgs/harness-console-shared-ts/harness-windows';
import {
  CheckIcon,
  PlusIcon,
  SaveIcon,
  SearchIcon,
  ServerIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { ResponsiveSurface } from '@pkgs/ui-root-client-ts/responsive-surface';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { For, type JSX, Show } from 'solid-js';
import { harnessNodeIcon } from './node-chrome';

/** What the menu can do besides showing a panel. */
export type HarnessDevMenuAction =
  | 'add-client'
  | 'nodes'
  | 'snapshots'
  | 'commands';

function PanelRow(props: {
  readonly panel: HarnessPanelRef;
  readonly shown: boolean;
  readonly onShow: (panel: string) => void;
}): JSX.Element {
  const Icon = harnessNodeIcon(props.panel.kind);
  return (
    <MenuRow
      title={props.panel.title}
      leading={<Icon size={18} color="icon" />}
      selected={props.shown}
      hideChevron
      trailing={
        <Show when={props.shown}>
          <CheckIcon size={18} color="icon" />
        </Show>
      }
      dataSet={{ 'harness-part': 'menu-panel', 'panel-id': props.panel.id }}
      onClick={() => props.onShow(props.panel.id)}
    />
  );
}

/**
 * Everything the harness offers that a tap on its button does not: any
 * client's app or any node behind the apps by name, another client, and the
 * harness's own tools. Choosing a row closes it.
 */
export function HarnessDevMenu(props: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly panels: readonly HarnessPanelRef[];
  readonly shown: string | null;
  readonly busy: boolean;
  readonly onShow: (panel: string) => void;
  readonly onAction: (action: HarnessDevMenuAction) => void;
}): JSX.Element {
  const clients = () => props.panels.filter((panel) => panel.kind === 'client');
  const system = () => props.panels.filter((panel) => panel.kind !== 'client');
  const show = (panel: string): void => {
    props.onShow(panel);
    props.onClose();
  };
  const act = (action: HarnessDevMenuAction): void => {
    // Adding a client keeps the menu open: the new client appears in it.
    if (action !== 'add-client') props.onClose();
    props.onAction(action);
  };
  return (
    <ResponsiveSurface
      visible={props.open}
      onClose={props.onClose}
      title="Harness"
      label="Harness menu"
      size="small"
      stackId="product-harness-dev-menu"
    >
      <StackVertical gap="lg">
        <MenuSection title="Clients">
          <For each={clients()}>
            {(panel) => (
              <PanelRow
                panel={panel}
                shown={panel.id === props.shown}
                onShow={show}
              />
            )}
          </For>
          <MenuRow
            title="Add a client"
            leading={<PlusIcon size={18} color="icon" />}
            hideChevron
            disabled={props.busy}
            dataSet={{ 'harness-part': 'menu-add-client' }}
            onClick={() => act('add-client')}
          />
        </MenuSection>
        <MenuSection title="Behind the apps">
          <For each={system()}>
            {(panel) => (
              <PanelRow
                panel={panel}
                shown={panel.id === props.shown}
                onShow={show}
              />
            )}
          </For>
        </MenuSection>
        <MenuSection title="Harness">
          <MenuRow
            title="Nodes"
            caption="Add or remove clients and servers"
            leading={<ServerIcon size={18} color="icon" />}
            onClick={() => act('nodes')}
          />
          <MenuRow
            title="Snapshots"
            caption="Save this world, or go back to a saved one"
            leading={<SaveIcon size={18} color="icon" />}
            onClick={() => act('snapshots')}
          />
          <MenuRow
            title="Commands"
            caption="Crash, partition, the clock, appearance"
            leading={<SearchIcon size={18} color="icon" />}
            onClick={() => act('commands')}
          />
        </MenuSection>
      </StackVertical>
    </ResponsiveSurface>
  );
}
