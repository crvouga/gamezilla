import type { HarnessPanelRef } from '@pkgs/harness-console-shared-ts/harness-windows';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import { H1 } from '@pkgs/ui-root-client-ts/heading';
import {
  FlaskConicalIcon,
  SaveIcon,
  SearchIcon,
  ServerIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { ScrollView } from '@pkgs/ui-root-client-ts/scroll-view';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { For, type JSX, Show } from 'solid-js';
import { harnessNodeIcon } from './node-chrome';

/** A surface the harness app opens to set the world up. */
export type HarnessHomeTool = 'nodes' | 'snapshots' | 'commands';

/** A view the harness app opens: an instance's panel or an emulator's dashboard. */
export type HarnessHomeView = {
  readonly id: string;
  readonly title: string;
};

function ViewRow(props: {
  readonly view: HarnessHomeView;
  readonly icon: IconComponent;
  readonly onShow: (view: string) => void;
}): JSX.Element {
  return (
    <MenuRow
      title={props.view.title}
      leading={<props.icon size={18} color="icon" />}
      dataSet={{ 'harness-part': 'home-view', 'view-id': props.view.id }}
      onClick={() => props.onShow(props.view.id)}
    />
  );
}

/** Navigation within the Instances surface of the preview. */
export function HarnessHome(props: {
  /** Every running instance, along the request path. */
  readonly panels: readonly HarnessPanelRef[];
  /** The vendor emulators that have a dashboard to show. */
  readonly emulators: readonly HarnessHomeView[];
  readonly onShow: (view: string) => void;
  readonly onOpen: (tool: HarnessHomeTool) => void;
}): JSX.Element {
  return (
    <ScrollView grow padding="md" gap="lg" measure="menu" measureAlign="center">
      <StackVertical gap="xs">
        <H1>Instances</H1>
      </StackVertical>
      <MenuSection
        title="Running instances"
        footer="Everything running: each client's app, and what answers it."
      >
        <For each={props.panels}>
          {(panel) => (
            <ViewRow
              view={panel}
              icon={harnessNodeIcon(panel.kind)}
              onShow={props.onShow}
            />
          )}
        </For>
      </MenuSection>
      <Show when={props.emulators.length > 0}>
        <MenuSection
          title="Emulators"
          footer="Each vendor's own dashboard: its state, journal, clock, latency and faults."
        >
          <For each={props.emulators}>
            {(emulator) => (
              <ViewRow
                view={emulator}
                icon={FlaskConicalIcon}
                onShow={props.onShow}
              />
            )}
          </For>
        </MenuSection>
      </Show>
      <MenuSection title="Set up the world">
        <MenuRow
          title="Add or remove instances"
          caption="Clients and servers, down to none of either"
          leading={<ServerIcon size={18} color="icon" />}
          dataSet={{ 'harness-part': 'home-tool', tool: 'nodes' }}
          onClick={() => props.onOpen('nodes')}
        />
        <MenuRow
          title="Snapshots"
          caption="Save this world, or go back to a saved one"
          leading={<SaveIcon size={18} color="icon" />}
          dataSet={{ 'harness-part': 'home-tool', tool: 'snapshots' }}
          onClick={() => props.onOpen('snapshots')}
        />
        <MenuRow
          title="Commands"
          caption="Crash, restart and partition instances, the clock, appearance"
          leading={<SearchIcon size={18} color="icon" />}
          dataSet={{ 'harness-part': 'home-tool', tool: 'commands' }}
          onClick={() => props.onOpen('commands')}
        />
      </MenuSection>
    </ScrollView>
  );
}
