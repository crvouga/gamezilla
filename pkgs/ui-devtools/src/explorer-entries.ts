/**
 * Explorer entries for the devtools components. Not part of `@pkgs/ui`'s
 * built-in `componentRegistry`; an explorer that wants them passes these as
 * (part of) its `entries`.
 */
import type { ComponentEntry } from '@pkgs/ui';
import DataTableExample from './data-table/data-table.example';
import JsonViewExample from './json-view/json-view.example';
import TabStripExample from './tab-strip/tab-strip.example';

export const UI_DEVTOOLS_EXPLORER_ENTRIES: readonly ComponentEntry[] = [
  {
    id: 'data-table',
    title: 'DataTable',
    group: 'Data Display',
    Example: DataTableExample,
  },
  {
    id: 'json-view',
    title: 'JsonView',
    group: 'Data Display',
    Example: JsonViewExample,
  },
  {
    id: 'tab-strip',
    title: 'TabStrip',
    group: 'Inputs',
    Example: TabStripExample,
  },
];
