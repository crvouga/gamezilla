import { HARNESS_APP_VIEW } from '@pkgs/harness-console-shared-ts/harness-windows';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import { ResponsiveSurface } from '@pkgs/ui-root-client-ts/responsive-surface';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Switch } from '@pkgs/ui-root-client-ts/switch';
import { P } from '@pkgs/ui-root-client-ts/text';
import { For } from 'solid-js';
import { InspectorRow } from './inspector-row';

const GLYPH_SIZE = 16;

/** A view the switcher can go through. */
export type HarnessSwitcherView = {
  readonly id: string;
  readonly title: string;
  readonly icon: IconComponent;
  /** Whether the switcher goes through it now. */
  readonly on: boolean;
};

/**
 * Which apps the round button goes through: every view there is (each
 * instance, each emulator's dashboard), in or out. It starts with every
 * client's app in and the rest out. The harness's own app is always one of
 * them, since it is the way back here, so it is listed and cannot be taken
 * out. A view that is out is still opened from the harness app.
 */
export function ProductHarnessSwitcherSurface(props: {
  readonly views: readonly HarnessSwitcherView[];
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onChange: (view: string, on: boolean) => void;
}) {
  return (
    <ResponsiveSurface
      visible={props.open}
      onClose={props.onClose}
      title="Switcher"
      label="The apps the switcher goes through"
      size="small"
      stackId="product-harness-switcher"
    >
      <StackVertical gap="md">
        <P tone="secondary">
          The round button goes through these, in this order, then round again.
        </P>
        <StackVertical>
          <For each={props.views}>
            {(view) => (
              <InspectorRow
                label={view.title}
                leading={<view.icon size={GLYPH_SIZE} color="icon" />}
                trailing={
                  <Switch
                    value={view.on}
                    disabled={view.id === HARNESS_APP_VIEW}
                    aria-label={`${view.title} in the switcher`}
                    dataSet={{
                      'harness-part': 'switcher-view',
                      'view-id': view.id,
                    }}
                    onValueChange={(on) => props.onChange(view.id, on)}
                  />
                }
              />
            )}
          </For>
        </StackVertical>
      </StackVertical>
    </ResponsiveSurface>
  );
}
