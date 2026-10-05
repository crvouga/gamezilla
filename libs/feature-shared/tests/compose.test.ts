import { describe, expect, test } from 'bun:test';
import { composeFeatures } from '@libs/feature-shared/compose';
import type { FeatureManifest } from '@libs/feature-shared/manifest';
import { defineFeature } from '@libs/feature-shared/manifest';
import { defineTable } from '@pkgs/db-schema-root-shared/define-table';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { defineQuery } from '@pkgs/sync-engine-shared/define-query';
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

function widgetFeature(
  onLoad: () => void = () => undefined
): FeatureManifest<'widget', readonly [typeof widget]> {
  return defineFeature({
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

const gadgetFeature = defineFeature({
  name: 'gadget',
  tables: [gadget] as const,
  topicMap: { gadget: { topics: () => ['user:a'] } },
  queries: [listGadgets],
  mutations: () => Promise.resolve([]),
});

describe('composeFeatures', () => {
  test('folds the declared slice of every layer', async () => {
    const app = composeFeatures([widgetFeature(), gadgetFeature]);
    expect(app.featureNames).toEqual(['widget', 'gadget']);
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
    const app = composeFeatures([widgetFeature()]);
    expect(Object.keys(app.schema.snapshot().tables)).toEqual(['widget']);
    expect(app.ownerOfTable.get('widget')).toBe('widget');
  });

  test('mutation thunks run once per composition', async () => {
    let loads = 0;
    const app = composeFeatures([
      widgetFeature(() => {
        loads += 1;
      }),
    ]);
    await app.mutations();
    await app.mutations();
    expect(loads).toBe(1);
  });

  test('a table may be declared by only one feature', () => {
    const impostor = defineFeature({
      name: 'impostor',
      tables: [widget] as const,
      topicMap: {},
      queries: [],
      mutations: () => Promise.resolve([]),
    });
    expect(() => composeFeatures([widgetFeature(), impostor])).toThrow(
      /table 'widget' is declared by both/
    );
  });

  test('feature names are unique', () => {
    expect(() => composeFeatures([widgetFeature(), widgetFeature()])).toThrow(
      /duplicate feature 'widget'/
    );
  });

  test('a feature cannot map topics for a table it does not declare', () => {
    const reacher = {
      ...gadgetFeature,
      topicMap: { widget: { topics: () => ['user:a'] } },
    } as unknown as FeatureManifest;
    expect(() => composeFeatures([widgetFeature(), reacher])).toThrow(
      /maps topics for table 'widget', which it does not declare/
    );
  });
});
