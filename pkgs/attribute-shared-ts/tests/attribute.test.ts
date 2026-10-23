import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Assert } from '@pkgs/assert-root-shared-ts/assert';
import type { AttributeState } from '@pkgs/attribute-shared-ts/attribute';
import { createAttrNamespace } from '@pkgs/attribute-shared-ts/attribute';

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

describe('createAttrNamespace', () => {
  it('rejects zero segments', () => {
    expect(() => createAttrNamespace()).toThrow();
  });

  it('rejects invalid segment (slash)', () => {
    expect(() => createAttrNamespace('a/b')).toThrow();
  });

  it('rejects invalid segment (consecutive hyphens)', () => {
    expect(() => createAttrNamespace('a--b')).toThrow();
  });

  it('rejects digit-first segment', () => {
    expect(() => createAttrNamespace('0bad')).toThrow();
  });

  it('rejects single-character namespace segment', () => {
    expect(() => createAttrNamespace('x')).toThrow();
  });

  it('rejects camelCase segment', () => {
    expect(() => createAttrNamespace('helloThere')).toThrow();
  });

  it('joins multiple segments with dots', () => {
    const ns = createAttrNamespace('chess', 'main-menu');
    expect(ns.prefix).toBe('chess.main-menu');
  });

  it('rejects empty name', () => {
    const ns = createAttrNamespace('games');
    expect(() =>
      ns.text('', (v) => (typeof v === 'string' ? v : ''))
    ).toThrow();
  });

  it('rejects slash in name', () => {
    const ns = createAttrNamespace('games');
    expect(() =>
      ns.text('foo/bar', (v) => (typeof v === 'string' ? v : ''))
    ).toThrow();
  });

  it('rejects camelCase local name', () => {
    const ns = createAttrNamespace('games');
    expect(() =>
      ns.text('displayName', (v) => (typeof v === 'string' ? v : ''))
    ).toThrow();
  });

  it('rejects single-character local name', () => {
    const ns = createAttrNamespace('games');
    expect(() =>
      ns.text('x', (v) => (typeof v === 'string' ? v : ''))
    ).toThrow();
  });

  it('builds full key as prefix/name', () => {
    const ns = createAttrNamespace('games');
    const Selected = ns.textOrNull('selected', (v): string | null =>
      typeof v === 'string' ? v : null
    );
    expect(String(Selected.key)).toBe('games/selected');
  });

  it('callable builds single-key patch', () => {
    const ns = createAttrNamespace('games');
    const Selected = ns.textOrNull('selected', (v): 'chess' | null =>
      v === 'chess' ? 'chess' : null
    );
    expect(Selected('chess')).toEqual({ 'games/selected': 'chess' });
    expect(Selected('nope')).toEqual({ 'games/selected': null });
  });

  it('.parse validates raw value without wrapping', () => {
    const ns = createAttrNamespace('games');
    const Selected = ns.textOrNull('selected', (v): 'chess' | null =>
      v === 'chess' ? 'chess' : null
    );
    expect(Selected.parse('chess')).toBe('chess');
    expect(Selected.parse('nope')).toBe(null);
  });

  it('.from reads flat key and parses', () => {
    const ns = createAttrNamespace('profile');
    const DisplayName = ns.text('display-name', (v): string =>
      typeof v === 'string' ? v : ''
    );
    const state: AttributeState = DisplayName('Ada');
    expect(DisplayName.from(state)).toBe('Ada');
    expect(DisplayName.from({} as AttributeState)).toBe('');
  });

  it('parser throw propagates from callable', () => {
    const ns = createAttrNamespace('games');
    const Selected = ns.text('selected', (_v): never => {
      throw new Error('bad');
    });
    expect(() => Selected('x')).toThrow('bad');
  });

  it('parser throw propagates from .from', () => {
    const ns = createAttrNamespace('games');
    const Selected = ns.text('selected', (_v): never => {
      throw new Error('bad');
    });
    const state = { [Selected.key]: 1 } as AttributeState;
    expect(() => Selected.from(state)).toThrow('bad');
  });

  it('parser throw propagates from .parse', () => {
    const ns = createAttrNamespace('games');
    const Selected = ns.text('selected', (_v): never => {
      throw new Error('bad');
    });
    expect(() => Selected.parse(1)).toThrow('bad');
  });
});

describe('DataType + nullable metadata', () => {
  it('text tag carries dataType="text", nullable=false', () => {
    const ns = createAttrNamespace('profile');
    const tag = ns.text('display-name', (v) =>
      typeof v === 'string' ? v : ''
    );
    expect(tag.dataType).toBe('text');
    expect(tag.nullable).toBe(false);
    expect(tag.enumValues).toEqual([]);
  });

  it('textOrNull tag carries nullable=true', () => {
    const ns = createAttrNamespace('profile');
    const tag = ns.textOrNull('cursor', (v): string | null =>
      typeof v === 'string' ? v : null
    );
    expect(tag.dataType).toBe('text');
    expect(tag.nullable).toBe(true);
  });

  it('integer tag has dataType="integer"', () => {
    const ns = createAttrNamespace('chess', 'puzzle');
    const tag = ns.integer('rating', (v) =>
      typeof v === 'number' && Number.isInteger(v) ? v : 0
    );
    expect(tag.dataType).toBe('integer');
    expect(tag.nullable).toBe(false);
  });

  it('boolean / number / bigint / binary tags carry correct dataType', () => {
    const ns = createAttrNamespace('demo');
    expect(
      ns.boolean('flag', (v) => typeof v === 'boolean' && v).dataType
    ).toBe('boolean');
    expect(
      ns.number('amount', (v) => (typeof v === 'number' ? v : 0)).dataType
    ).toBe('number');
    expect(
      ns.bigint('counter', (v) => (typeof v === 'bigint' ? v : 0n)).dataType
    ).toBe('bigint');
    expect(
      ns.binary('blob', (v) => (v instanceof Uint8Array ? v : new Uint8Array()))
        .dataType
    ).toBe('binary');
  });

  it('json / array tags carry correct dataType', () => {
    const ns = createAttrNamespace('demo');
    expect(
      ns.json('cfg', (v) =>
        v !== null && typeof v === 'object' && !Array.isArray(v)
          ? (v as Record<string, unknown>)
          : {}
      ).dataType
    ).toBe('json');
    expect(
      ns.array<string>('themes', (v) =>
        Array.isArray(v)
          ? v.filter((x): x is string => typeof x === 'string')
          : []
      ).dataType
    ).toBe('array');
  });

  it('date / timestamp / time / email / url / uuid map to text-shaped types', () => {
    const ns = createAttrNamespace('demo');
    const readStr = (v: unknown): string => (typeof v === 'string' ? v : '');
    expect(ns.date('birth-date', readStr).dataType).toBe('date');
    expect(ns.timestamp('created-at', readStr).dataType).toBe('timestamp');
    expect(ns.time('cutoff', readStr).dataType).toBe('time');
    expect(ns.email('contact', readStr).dataType).toBe('email');
    expect(ns.url('homepage', readStr).dataType).toBe('url');
    expect(ns.uuid('identifier', readStr).dataType).toBe('uuid');
  });
});

describe('enum tag', () => {
  it('defaults to values[0] on missing / invalid input', () => {
    const ns = createAttrNamespace('chess', 'puzzle', 'play');
    const Status = ns.enum('status', [
      'idle',
      'solving',
      'wrong',
      'solved',
    ] as const);
    expect(Status.dataType).toBe('enum');
    expect(Status.enumValues).toEqual(['idle', 'solving', 'wrong', 'solved']);
    expect(Status.parse(undefined)).toBe('idle');
    expect(Status.parse('garbage')).toBe('idle');
    expect(Status.parse('solving')).toBe('solving');
  });

  it('enumOrNull returns null on missing / invalid input by default', () => {
    const ns = createAttrNamespace('chess', 'puzzle', 'play');
    const Status = ns.enumOrNull('status', ['idle', 'solving'] as const);
    expect(Status.dataType).toBe('enum');
    expect(Status.nullable).toBe(true);
    expect(Status.parse(undefined)).toBeNull();
    expect(Status.parse('nope')).toBeNull();
    expect(Status.parse('idle')).toBe('idle');
  });

  it('accepts a custom parser', () => {
    const ns = createAttrNamespace('demo');
    const Status = ns.enum(
      'status',
      ['on', 'off'] as const,
      (v): 'on' | 'off' => (v === 1 ? 'on' : 'off')
    );
    expect(Status.parse(1)).toBe('on');
    expect(Status.parse(0)).toBe('off');
  });

  it('rejects empty values array', () => {
    const ns = createAttrNamespace('demo');
    expect(() =>
      ns.enum('status', [] as unknown as readonly [string, ...string[]])
    ).toThrow();
  });
});

describe('indexed()', () => {
  it('returns null index by default', () => {
    const ns = createAttrNamespace('demo');
    const Tag = ns.text('name', (v) => String(v));
    expect(Tag.index).toBeNull();
  });

  it('returns a tag with index spec set, preserving identity', () => {
    const ns = createAttrNamespace('demo');
    const Base = ns.integer('rating', (v) => Number(v));
    const Indexed = Base.indexed({ sortable: true });
    expect(Indexed.key).toBe(Base.key);
    expect(Indexed.dataType).toBe('integer');
    expect(Indexed.nullable).toBe(false);
    expect(Indexed.parse(42)).toBe(42);
    expect(Indexed.index).toEqual({ sortable: true, unique: false });
  });

  it('defaults sortable/unique to false', () => {
    const ns = createAttrNamespace('demo');
    const Tag = ns.text('owner', (v) => String(v)).indexed();
    expect(Tag.index).toEqual({ sortable: false, unique: false });
  });

  it('supports unique: true', () => {
    const ns = createAttrNamespace('demo');
    const Tag = ns.uuid('id', (v) => String(v)).indexed({ unique: true });
    expect(Tag.index).toEqual({ sortable: false, unique: true });
  });

  it('is idempotent — repeated calls overwrite, never accumulate', () => {
    const ns = createAttrNamespace('demo');
    const Base = ns.text('owner', (v) => String(v));
    const A = Base.indexed({ sortable: true });
    const B = A.indexed({ unique: true });
    expect(B.index).toEqual({ sortable: false, unique: true });
  });

  it('rejects indexed() on json tags (no scalar column form)', () => {
    const ns = createAttrNamespace('demo');
    const Tag = ns.json('payload', (v) => v as Record<string, unknown>);
    expect(() => Tag.indexed()).toThrow();
  });

  it('rejects indexed() on array tags', () => {
    const ns = createAttrNamespace('demo');
    const Tag = ns.array('tags', (v) => (v as string[]) ?? []);
    expect(() => Tag.indexed()).toThrow();
  });

  it('rejects indexed() on binary tags', () => {
    const ns = createAttrNamespace('demo');
    const Tag = ns.binary('blob', (v) => v as Uint8Array);
    expect(() => Tag.indexed()).toThrow();
  });
});
