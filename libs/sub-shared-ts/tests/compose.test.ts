import { describe, expect, test } from 'bun:test';
import { composeSubs } from '@libs/sub-shared-ts/compose';
import type { SubManifest } from '@libs/sub-shared-ts/manifest';
import { defineSub } from '@libs/sub-shared-ts/manifest';
import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { defineQuery } from '@pkgs/sync-engine-shared-ts/define-query';
import { z } from 'zod';

const widget = defineTable({
  domain: 'widget',
  name: 'widget',
  columns: { label: 'text' },
});

const gadget = defineTable({
  domain: 'gadget',
  name: 'gadget',
  columns: { label: 'text' },
});

const listWidgets = defineQuery({
  name: 'listWidgets',
  allowAnon: true,
  run: () => Promise.resolve({ widget: [] }),
});

const listGadgets = defineQuery({
  name: 'listGadgets',
  allowAnon: true,
  run: () => Promise.resolve({ gadget: [] }),
});

const renameWidget = defineMutation({
  name: 'renameWidget',
  args: z.object({ label: z.string() }),
  run: () => Promise.resolve(),
});

function widgetSub(
  onLoad: () => void = () => undefined
): SubManifest<'widget', readonly [typeof widget]> {
  return defineSub({
    name: 'widget',
    tables: [widget] as const,
    topicMap: { widget: { topics: () => ['user:a'] } },
    queries: [listWidgets],
    mutations: () => {
      onLoad();
      return Promise.resolve([renameWidget]);
    },
  });
}

const gadgetSub = defineSub({
  name: 'gadget',
  tables: [gadget] as const,
  topicMap: { gadget: { topics: () => ['user:a'] } },
  queries: [listGadgets],
  mutations: () => Promise.resolve([]),
});

describe('composeSubs', () => {
  test('folds the declared slice of every layer', async () => {
    const app = composeSubs([widgetSub(), gadgetSub]);
    expect(app.subNames).toEqual(['widget', 'gadget']);
    expect(app.tables.map((table) => table.name)).toEqual(['widget', 'gadget']);
    expect(app.tableNames).toEqual(['gadget', 'widget']);
    expect(app.domains).toEqual(['gadget', 'widget']);
    expect(Object.keys(app.queries).sort()).toEqual([
      'listGadgets',
      'listWidgets',
    ]);
    expect(Object.keys(app.topicMap).sort()).toEqual(['gadget', 'widget']);
    expect(Object.keys(await app.mutations())).toEqual(['renameWidget']);
  });

  test('the schema is exactly the union of declared tables', () => {
    const app = composeSubs([widgetSub()]);
    expect(Object.keys(app.schema.snapshot().tables)).toEqual(['widget']);
    expect(app.ownerOfTable.get('widget')).toBe('widget');
  });

  test('mutation thunks run once per composition', async () => {
    let loads = 0;
    const app = composeSubs([
      widgetSub(() => {
        loads += 1;
      }),
    ]);
    await app.mutations();
    await app.mutations();
    expect(loads).toBe(1);
  });

  test('a table may be declared by only one sub', () => {
    const impostor = defineSub({
      name: 'impostor',
      tables: [widget] as const,
      topicMap: {},
      queries: [],
      mutations: () => Promise.resolve([]),
    });
    expect(() => composeSubs([widgetSub(), impostor])).toThrow(
      /table 'widget' is declared by both/
    );
  });

  test('sub names are unique', () => {
    expect(() => composeSubs([widgetSub(), widgetSub()])).toThrow(
      /duplicate sub 'widget'/
    );
    const once = widgetSub();
    expect(() => composeSubs([once, once])).toThrow(/duplicate sub 'widget'/);
  });

  test('a sub cannot map topics for a table it does not declare', () => {
    const reacher = {
      ...gadgetSub,
      topicMap: { widget: { topics: () => ['user:a'] } },
    } as unknown as SubManifest;
    expect(() => composeSubs([widgetSub(), reacher])).toThrow(
      /maps topics for table 'widget', which it does not declare/
    );
  });
});

const parentRow = defineTable({
  domain: 'parent',
  name: 'parent_row',
  columns: { label: 'text' },
});

const childRow = defineTable({
  domain: 'child',
  name: 'child_row',
  columns: { label: 'text' },
});

const siblingRow = defineTable({
  domain: 'sibling',
  name: 'sibling_row',
  columns: { label: 'text' },
});

const listParent = defineQuery({
  name: 'listParent',
  allowAnon: true,
  run: () => Promise.resolve({ parent_row: [] }),
});

const listChild = defineQuery({
  name: 'listChild',
  allowAnon: true,
  run: () => Promise.resolve({ child_row: [] }),
});

const listSibling = defineQuery({
  name: 'listSibling',
  allowAnon: true,
  run: () => Promise.resolve({ sibling_row: [] }),
});

const renameParent = defineMutation({
  name: 'renameParent',
  args: z.object({ label: z.string() }),
  run: () => Promise.resolve(),
});

const renameChild = defineMutation({
  name: 'renameChild',
  args: z.object({ label: z.string() }),
  run: () => Promise.resolve(),
});

const renameSibling = defineMutation({
  name: 'renameSibling',
  args: z.object({ label: z.string() }),
  run: () => Promise.resolve(),
});

const childSub = defineSub({
  name: 'child',
  tables: [childRow] as const,
  topicMap: {},
  queries: [listChild],
  mutations: () => Promise.resolve([renameChild]),
});

const siblingSub = defineSub({
  name: 'sibling',
  tables: [siblingRow] as const,
  topicMap: {},
  queries: [listSibling],
  mutations: () => Promise.resolve([renameSibling]),
});

const parentSub = defineSub({
  name: 'parent',
  tables: [parentRow] as const,
  topicMap: {},
  queries: [listParent],
  mutations: () => Promise.resolve([renameParent]),
  subs: [childSub],
});

describe('composeSubs tree', () => {
  test('a parent fold keeps walk order and unions the child, not the sibling', async () => {
    const app = composeSubs([parentSub]);
    expect(app.subNames).toEqual(['parent', 'child']);
    expect(app.tables.map((table) => table.name)).toEqual([
      'parent_row',
      'child_row',
    ]);
    expect(app.ownerOfTable.get('parent_row')).toBe('parent');
    expect(app.ownerOfTable.get('child_row')).toBe('child');
    expect(app.ownerOfTable.has('sibling_row')).toBe(false);
    expect(Object.keys(app.queries).sort()).toEqual([
      'listChild',
      'listParent',
    ]);
    expect(Object.keys(await app.mutations()).sort()).toEqual([
      'renameChild',
      'renameParent',
    ]);
    const withSibling = composeSubs([parentSub, siblingSub]);
    expect(withSibling.subNames).toEqual(['parent', 'child', 'sibling']);
    expect(withSibling.ownerOfTable.get('sibling_row')).toBe('sibling');
  });

  test('a table declared on a nested sub and its parent fails', () => {
    const nested = defineSub({
      name: 'nested',
      tables: [widget] as const,
      topicMap: {},
      queries: [],
      mutations: () => Promise.resolve([]),
    });
    const owner = defineSub({
      name: 'owner',
      tables: [widget] as const,
      topicMap: {},
      queries: [],
      mutations: () => Promise.resolve([]),
      subs: [nested],
    });
    expect(() => composeSubs([owner])).toThrow(
      /table 'widget' is declared by both/
    );
  });

  test('a walk that re-enters a node fails', () => {
    const loop: SubManifest = defineSub({
      name: 'loop',
      tables: [] as const,
      topicMap: {},
      queries: [],
      mutations: () => Promise.resolve([]),
      get subs() {
        return [loop];
      },
    });
    expect(() => composeSubs([loop])).toThrow(/re-enters 'loop'/);
  });
});
