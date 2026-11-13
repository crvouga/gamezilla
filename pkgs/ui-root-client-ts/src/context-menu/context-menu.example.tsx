/** @jsxImportSource solid-js */

import { ContextMenu } from '@pkgs/ui-root-client-ts/context-menu';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import {
  FIELD_MENU,
  LINKED_IMAGE_MENU,
  PAGE_MENU,
  PASTE_REFUSED,
  SELECTION_MENU,
} from './context-menu.fixtures';

export type ContextMenuExampleState =
  | 'page'
  | 'selection'
  | 'field'
  | 'paste-refused'
  | 'linked-image';

const GROUPS = {
  page: PAGE_MENU,
  selection: SELECTION_MENU,
  field: FIELD_MENU,
  'paste-refused': FIELD_MENU,
  'linked-image': LINKED_IMAGE_MENU,
} as const;

/** Where the pointer was right-clicked in the example. */
const POINTER = { x: 48, y: 48 };

/** One right-click, the menu open at the pointer. */
export default function ContextMenuExample(props: {
  /** Defaults to `page`. */
  state?: ContextMenuExampleState;
}): JSX.Element {
  const state = (): ContextMenuExampleState => props.state ?? 'page';
  return (
    <ExampleRoot grow minHeight="lg">
      <ContextMenu
        open
        at={POINTER}
        groups={GROUPS[state()]}
        label="Actions"
        notice={state() === 'paste-refused' ? PASTE_REFUSED : undefined}
        onClose={() => undefined}
      />
    </ExampleRoot>
  );
}
