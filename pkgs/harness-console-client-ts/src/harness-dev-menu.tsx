import type { HarnessPanelRef } from '@pkgs/harness-console-shared-ts/harness-windows';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import {
  CheckIcon,
  FlaskConicalIcon,
  PlusIcon,
  SaveIcon,
  SearchIcon,
  ServerIcon,
  XIcon,
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

/** A view the menu can show: a node's panel or an emulator's dashboard. */
export type HarnessDevMenuView = {
  readonly id: string;
  readonly title: string;
};

function ViewRow(props: {
  readonly view: HarnessDevMenuView;
  readonly icon: IconComponent;
  readonly shown: boolean;
  readonly onShow: (view: string) => void;
  /** A control of its own beside the row (remove this client). */
  readonly accessory?: JSX.Element;
}): JSX.Element {
  return (
    <MenuRow
      title={props.view.title}
      leading={<props.icon size={18} color="icon" />}
      selected={props.shown}
      hideChevron
      trailing={
        <Show when={props.shown}>
          <CheckIcon size={18} color="icon" />
        </Show>
      }
      accessory={props.accessory}
      dataSet={{ 'harness-part': 'menu-panel', 'panel-id': props.view.id }}
      onClick={() => props.onShow(props.view.id)}
    />
  );
}

/** Takes a client out of the world. The last one stays: a world has a client. */
function RemoveClient(props: {
  readonly client: HarnessPanelRef;
  readonly disabled: boolean;
  readonly onRemove: (id: string) => void;
}): JSX.Element {
  return (
    <IconButton
      label={`Remove ${props.client.title}`}
      size={32}
      disabled={props.disabled}
      dataSet={{
        'harness-part': 'menu-remove-client',
        'panel-id': props.client.id,
      }}
      onClick={() => {
        if (props.client.node !== null) props.onRemove(props.client.node);
      }}
    >
      <XIcon size={16} color="icon" />
    </IconButton>
  );
}

/**
 * Everything the harness offers that a tap on its button does not: any
 * client's app, any node behind the apps or any vendor emulator's dashboard
 * by name, adding and removing clients, and the harness's own tools.
 * Choosing a row closes it.
 */
export function HarnessDevMenu(props: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly panels: readonly HarnessPanelRef[];
  /** The vendor emulators that have a dashboard to show. */
  readonly emulators: readonly HarnessDevMenuView[];
  readonly shown: string | null;
  readonly busy: boolean;
  readonly onShow: (panel: string) => void;
  readonly onRemoveClient: (id: string) => void;
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
              <ViewRow
                view={panel}
                icon={harnessNodeIcon(panel.kind)}
                shown={panel.id === props.shown}
                onShow={show}
                accessory={
                  <RemoveClient
                    client={panel}
                    disabled={props.busy || clients().length < 2}
                    onRemove={props.onRemoveClient}
                  />
                }
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
              <ViewRow
                view={panel}
                icon={harnessNodeIcon(panel.kind)}
                shown={panel.id === props.shown}
                onShow={show}
              />
            )}
          </For>
        </MenuSection>
        <Show when={props.emulators.length > 0}>
          <MenuSection title="Emulators">
            <For each={props.emulators}>
              {(emulator) => (
                <ViewRow
                  view={emulator}
                  icon={FlaskConicalIcon}
                  shown={emulator.id === props.shown}
                  onShow={show}
                />
              )}
            </For>
          </MenuSection>
        </Show>
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
