/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX } from 'solid-js';
import { MenuList } from '../menu-list/index';
import { MenuRow } from '../menu-row/index';
import { ResponsiveSurface } from '../responsive-surface/index';
import { spaceDataSet } from '../space-data-set';
import type { SpaceMenuItem } from '../space-types';

export type SpaceMenuSheetProps = {
  open: boolean;
  /** The sheet's title: `Space settings`, `More actions`. */
  title: string;
  items: readonly SpaceMenuItem[];
  onClose: () => void;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `SpaceMenuSheet` -- a short list of space actions in a sheet over the
 * stage (a centered dialog on wide layouts): the space settings behind row
 * 1's gear, and the action bar's More. Choosing a row closes the sheet,
 * then runs it; destructive rows wear the destructive ink.
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
