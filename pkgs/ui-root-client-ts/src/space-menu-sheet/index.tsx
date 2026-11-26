/** @jsxImportSource @solidjs/web */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { For } from 'solid-js';
import { MenuList } from '../menu-list/index';
import { MenuRow } from '../menu-row/index';
import { ResponsiveSurface } from '../responsive-surface/index';
import { spaceDataSet } from '../space-data-set';
import type { SpaceMenuItem } from '../space-types';

export type SpaceMenuSheetProps = {
  open: boolean;
  /** The modal's title: `More actions`. */
  title: string;
  items: readonly SpaceMenuItem[];
  onClose: () => void;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `SpaceMenuSheet` -- the action bar's More: the game actions that did not
 * fit the bar, in a modal centered over the stage at every width. The
 * space's own menu is never this modal: it opens against row 1's button
 * (`SpaceShell`). Choosing a row closes the modal, then runs it; destructive rows wear the destructive ink.
 */
export function SpaceMenuSheet(props: SpaceMenuSheetProps): JSX.Element {
  const run = (item: SpaceMenuItem): void => {
    props.onClose();
    item.onPress();
  };
  return (
    <ResponsiveSurface
      visible={props.open}
      onClose={() => props.onClose()}
      title={props.title}
      size="small"
      dataSet={{ component: 'SpaceMenuSheet', ...props.dataSet }}
    >
      <MenuList>
        <For each={props.items}>
          {(item) => (
            <MenuRow
              title={item.label}
              tone={item.tone === 'destructive' ? 'destructive' : 'default'}
              hideChevron
              disabled={item.disabled === true}
              onClick={() => run(item)}
              dataSet={spaceDataSet({ action: item.id }, item.testId)}
            />
          )}
        </For>
      </MenuList>
    </ResponsiveSurface>
  );
}
