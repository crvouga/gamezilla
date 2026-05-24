import { Assert } from '@pkgs/assert';
import { createAttrNamespace } from '@pkgs/attribute';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { defineEntitySchema } from './entity-schema';
import {
  createEntitySchemaRegistry,
  EMPTY_FROZEN_ENTITY_SCHEMA_REGISTRY,
} from './entity-schema-registry';

let disposeTestCrashHandler: () => void;
beforeAll(() => {
  disposeTestCrashHandler = Assert.registerCrashHandler({
    priority: 0,
    match: () => true,
    crash(message, context) {
      throw new Error(
        context === undefined
          ? message
          : `${message} ${JSON.stringify(context)}`
      );
    },
  });
});
afterAll(() => {
  disposeTestCrashHandler();
});

const demoNs = createAttrNamespace('demo');
const DemoAttr = {
  id: demoNs.text('id', (v) => String(v ?? '')).indexed({ unique: true }),
  rating: demoNs
    .integer('rating', (v) => Number(v ?? 0))
    .indexed({ sortable: true }),
  name: demoNs.text('name', (v) => String(v ?? '')),
};

describe('defineEntitySchema', () => {
  it('collects all declared attributes', () => {
    const schema = defineEntitySchema({
      entityType: 'demo',
      attributes: DemoAttr,
    });
    expect(schema.entityType).toBe('demo');
    expect(schema.attributes.size).toBe(3);
    expect(schema.attributes.has(DemoAttr.id.key)).toBe(true);
    expect(schema.attributes.has(DemoAttr.rating.key)).toBe(true);
    expect(schema.attributes.has(DemoAttr.name.key)).toBe(true);
  });

  it('separates indexed attributes', () => {
    const schema = defineEntitySchema({
      entityType: 'demo',
      attributes: DemoAttr,
    });
    expect(schema.indexedAttributes.size).toBe(2);
    expect(schema.indexedAttributes.has(DemoAttr.id.key)).toBe(true);
    expect(schema.indexedAttributes.has(DemoAttr.rating.key)).toBe(true);
    expect(schema.indexedAttributes.has(DemoAttr.name.key)).toBe(false);
  });

  it('derives single-field indexes from .indexed() tags', () => {
    const schema = defineEntitySchema({
      entityType: 'demo',
      attributes: DemoAttr,
    });
    expect(schema.indexes.length).toBe(2);
    const idIdx = schema.indexes.find((i) => i.localName === 'id');
    expect(idIdx).toBeDefined();
    expect(idIdx?.singleField).toBe(true);
    expect(idIdx?.unique).toBe(true);
    expect(idIdx?.fields).toEqual([
      { attributeKey: DemoAttr.id.key, direction: 'asc' },
    ]);
  });

  it('accepts composite indexes referencing declared attributes', () => {
    const schema = defineEntitySchema({
      entityType: 'demo',
      attributes: DemoAttr,
      composite: [
        {
          name: 'rating-name',
          fields: [
            { tag: DemoAttr.rating, direction: 'desc' },
            { tag: DemoAttr.name },
          ],
        },
      ],
    });
    const composite = schema.indexes.find((i) => i.localName === 'rating-name');
    expect(composite).toBeDefined();
    expect(composite?.singleField).toBe(false);
    expect(composite?.fields).toEqual([
      { attributeKey: DemoAttr.rating.key, direction: 'desc' },
      { attributeKey: DemoAttr.name.key, direction: 'asc' },
    ]);
  });

  it('rejects composite index referencing undeclared attribute', () => {
    const otherNs = createAttrNamespace('other');
    const Other = otherNs.text('foo', (v) => String(v));
    expect(() =>
      defineEntitySchema({
        entityType: 'demo',
        attributes: DemoAttr,
        composite: [{ name: 'bad', fields: [{ tag: Other }] }],
      })
    ).toThrow();
  });

  it('rejects duplicate composite index names', () => {
    expect(() =>
      defineEntitySchema({
        entityType: 'demo',
        attributes: DemoAttr,
        composite: [
          { name: 'dup', fields: [{ tag: DemoAttr.rating }] },
          { name: 'dup', fields: [{ tag: DemoAttr.name }] },
        ],
      })
    ).toThrow();
  });
});

describe('EntitySchemaRegistry', () => {
  it('registers schemas and exposes them via the frozen view', () => {
    const schema = defineEntitySchema({
      entityType: 'demo',
      attributes: DemoAttr,
    });
    const frozen = createEntitySchemaRegistry().register(schema).freeze();
    expect(frozen.size).toBe(1);
    expect(frozen.has('demo')).toBe(true);
    expect(frozen.get('demo')).toBe(schema);
    expect(frozen.get('missing')).toBeNull();
  });

  it('crashes on duplicate registration', () => {
    const schema = defineEntitySchema({
      entityType: 'demo',
      attributes: DemoAttr,
    });
    expect(() =>
      createEntitySchemaRegistry().register(schema).register(schema)
    ).toThrow();
  });

  it('crashes when register is called after freeze', () => {
    const schema = defineEntitySchema({
      entityType: 'demo',
      attributes: DemoAttr,
    });
    const registry = createEntitySchemaRegistry();
    registry.register(schema);
    registry.freeze();
    expect(() =>
      registry.register(
        defineEntitySchema({ entityType: 'other', attributes: DemoAttr })
      )
    ).toThrow();
  });

  it('EMPTY_FROZEN_ENTITY_SCHEMA_REGISTRY is empty and usable', () => {
    expect(EMPTY_FROZEN_ENTITY_SCHEMA_REGISTRY.size).toBe(0);
    expect(EMPTY_FROZEN_ENTITY_SCHEMA_REGISTRY.has('demo')).toBe(false);
    expect([...EMPTY_FROZEN_ENTITY_SCHEMA_REGISTRY.values()]).toEqual([]);
  });
});
