import {
  HARNESS_SWITCH_KEYS,
  type HarnessPanelRef,
} from '@pkgs/harness-console-shared-ts/harness-windows';
import { CommandPaletteKbd } from '@pkgs/ui-root-client-ts/command-palette-kbd';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import {
  ArrowLeftRightIcon,
  FlaskConicalIcon,
  SaveIcon,
  SearchIcon,
  ServerIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { ScrollView } from '@pkgs/ui-root-client-ts/scroll-view';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { H1, P } from '@pkgs/ui-root-client-ts/text';
import { For, type JSX, Show } from 'solid-js';
import { harnessNodeIcon } from './node-chrome';

/** A surface the harness app opens to set the world up. */
export type HarnessHomeTool = 'nodes' | 'snapshots' | 'commands';

/** A view the harness app opens: a node's panel or an emulator's dashboard. */
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

/** A key and what it does: read, not pressed. */
function KeyRow(props: {
  readonly does: string;
  readonly keys: string;
  readonly caption?: string | undefined;
}): JSX.Element {
  return (
    <MenuRow
      title={props.does}
      caption={props.caption}
      hideChevron
      trailing={<CommandPaletteKbd shortcut={props.keys} />}
    />
  );
}

/**
 * The harness's own app: everything that sets the world up, and the way to
 * everything in it. It is one of the apps the switcher goes through, beside
 * each client's, and the only place the rest is reached from: any client's
 * app, any node behind the apps, any vendor emulator's dashboard, and the
 * surfaces that add and remove nodes, save and restore the world, and run
 * its commands. Every row leads somewhere; nothing is changed on this page.
 */
export function HarnessHome(props: {
  readonly panels: readonly HarnessPanelRef[];
  /** The vendor emulators that have a dashboard to show. */
  readonly emulators: readonly HarnessHomeView[];
  readonly onShow: (view: string) => void;
  readonly onOpen: (tool: HarnessHomeTool) => void;
}): JSX.Element {
  const clients = () => props.panels.filter((panel) => panel.kind === 'client');
  const system = () => props.panels.filter((panel) => panel.kind !== 'client');
  return (
    <ScrollView grow padding="md" gap="lg" measure="menu" measureAlign="center">
      <StackVertical gap="xs">
        <H1>Harness</H1>
        <P tone="secondary">
          The whole system runs in this tab. Set it up here; the round button
          switches between the apps.
        </P>
      </StackVertical>
      <MenuSection title="Apps">
        <For each={clients()}>
          {(panel) => (
            <ViewRow
              view={panel}
              icon={harnessNodeIcon(panel.kind)}
              onShow={props.onShow}
            />
          )}
        </For>
      </MenuSection>
      <MenuSection title="Set up the world">
        <MenuRow
          title="Nodes"
          caption="Add or remove clients and servers"
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
          caption="Crash, restart and partition nodes, the clock, appearance"
          leading={<SearchIcon size={18} color="icon" />}
          dataSet={{ 'harness-part': 'home-tool', tool: 'commands' }}
          onClick={() => props.onOpen('commands')}
        />
      </MenuSection>
      <MenuSection title="Behind the apps">
        <For each={system()}>
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
      <MenuSection title="Keyboard">
        <MenuRow
          title="The round button"
          caption="Press it, or Enter on it, for the next app"
          hideChevron
          trailing={<ArrowLeftRightIcon size={18} color="icon" />}
        />
        <KeyRow does="Next app" keys={HARNESS_SWITCH_KEYS.next} />
        <KeyRow does="Previous app" keys={HARNESS_SWITCH_KEYS.previous} />
        <KeyRow
          does="An app by its place"
          caption="1 to 9, in the order above"
          keys={HARNESS_SWITCH_KEYS.app}
        />
        <KeyRow does="This app" keys={HARNESS_SWITCH_KEYS.harness} />
      </MenuSection>
    </ScrollView>
  );
}
