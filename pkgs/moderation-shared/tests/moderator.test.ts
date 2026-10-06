import { describe, expect, test } from 'bun:test';

import {
  defineDynamicCheck,
  defineStaticCheck,
  predicateCheck,
} from '@pkgs/moderation-shared/check';
import { createModerator } from '@pkgs/moderation-shared/moderator';
import { defineModerationPolicy } from '@pkgs/moderation-shared/policy';

const containsBad = predicateCheck({
  id: 'bad',
  version: 1,
  code: 'bad_word',
  matches: (text) => text.includes('bad'),
});

const containsMeh = predicateCheck({
  id: 'meh',
  version: 1,
  code: 'meh_word',
  action: 'mask',
  matches: (text) => text.includes('meh'),
});

function policyWith(dynamicVersion = 1) {
  return defineModerationPolicy({
    name: {
      checks: [
        containsMeh,
        containsBad,
        defineDynamicCheck({
          id: 'remote',
          version: dynamicVersion,
          inspect: async (text) =>
            text.includes('rude') ? { code: 'toxic' } : null,
        }),
      ],
      mask: { kind: 'alias', alias: (subject) => `alias-${subject.id}` },
    },
    title: {
      checks: [containsBad],
      mask: { kind: 'hide' },
    },
    note: {
      checks: [containsBad],
      mask: { kind: 'censor', censor: (text) => text.replace(/bad/g, '***') },
    },
  });
}

describe('checkWrite', () => {
  test('refuses text a refusing check matches and names the finding', () => {
    const moderator = createModerator(policyWith());
    expect(moderator.checkWrite('name', 'so bad')).toEqual({
      allowed: false,
      finding: { check: 'bad', code: 'bad_word', action: 'refuse' },
    });
  });

  test('accepts text only a masking check matches', () => {
    const moderator = createModerator(policyWith());
    expect(moderator.checkWrite('name', 'meh')).toEqual({ allowed: true });
  });

  test('empty text is clean', () => {
    expect(createModerator(policyWith()).checkWrite('name', '')).toEqual({
      allowed: true,
    });
  });
});

describe('display', () => {
  const subject = { id: 'p1' };

  test('clean text is shown as stored', () => {
    const moderator = createModerator(policyWith());
    expect(moderator.display('name', 'alice', subject)).toEqual({
      masked: false,
      text: 'alice',
    });
  });

  test('each kind masks with its own strategy', () => {
    const moderator = createModerator(policyWith());
    expect(moderator.display('name', 'bad', subject).text).toBe('alias-p1');
    expect(moderator.display('name', 'meh', subject).text).toBe('alias-p1');
    expect(moderator.display('title', 'bad', subject)).toMatchObject({
      masked: true,
      text: null,
    });
    expect(moderator.display('note', 'not bad', subject).text).toBe('not ***');
  });

  test('a live dynamic verdict masks; a retired version is ignored', () => {
    const verdict = {
      checkKey: 'remote@1',
      finding: { check: 'remote', code: 'toxic', action: 'refuse' as const },
    };
    expect(
      createModerator(policyWith(1)).display('name', 'x', subject, [verdict])
        .masked
    ).toBe(true);
    expect(
      createModerator(policyWith(2)).display('name', 'x', subject, [verdict])
        .masked
    ).toBe(false);
  });
});

describe('inspectDynamic', () => {
  test('records a verdict per dynamic check, clean ones included', async () => {
    const moderator = createModerator(policyWith());
    expect(await moderator.inspectDynamic('name', 'rude')).toEqual([
      {
        checkKey: 'remote@1',
        finding: { check: 'remote', code: 'toxic', action: 'refuse' },
      },
    ]);
    expect(await moderator.inspectDynamic('name', 'nice')).toEqual([
      { checkKey: 'remote@1', finding: null },
    ]);
  });
});

describe('efficiency', () => {
  test('static checks run once per text and stop at the first refusal', () => {
    let first = 0;
    let second = 0;
    const policy = defineModerationPolicy({
      name: {
        checks: [
          defineStaticCheck({
            id: 'first',
            version: 1,
            inspect: () => {
              first += 1;
              return { code: 'x' };
            },
          }),
          defineStaticCheck({
            id: 'second',
            version: 1,
            inspect: () => {
              second += 1;
              return null;
            },
          }),
        ],
        mask: { kind: 'hide' },
      },
    });
    const moderator = createModerator(policy);
    for (let i = 0; i < 5; i += 1) {
      moderator.checkWrite('name', 'same');
      moderator.display('name', 'same', { id: String(i) });
    }
    expect(first).toBe(1);
    expect(second).toBe(0);
  });
});

describe('defineModerationPolicy', () => {
  test('the fingerprint changes when a check version changes', () => {
    expect(policyWith(1).fingerprint).not.toBe(policyWith(2).fingerprint);
    expect(policyWith(1).fingerprint).toBe(policyWith(1).fingerprint);
  });

  test('refuses duplicate check ids within a kind', () => {
    expect(() =>
      defineModerationPolicy({
        name: { checks: [containsBad, containsBad], mask: { kind: 'hide' } },
      })
    ).toThrow('duplicate check id');
  });
});
