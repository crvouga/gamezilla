import { describe, expect, test } from 'bun:test';
import { predicateCheck } from '@pkgs/moderation-shared-ts/check';
import { createModerator } from '@pkgs/moderation-shared-ts/moderator';
import { defineModerationPolicy } from '@pkgs/moderation-shared-ts/policy';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const arbPolicy = fc
  .uniqueArray(
    fc.record({
      needle: fc.string({ minLength: 1, maxLength: 2 }),
      action: fc.constantFrom('mask' as const, 'refuse' as const),
    }),
    { minLength: 1, maxLength: 4, selector: (c) => c.needle }
  )
  .map((rules) =>
    defineModerationPolicy({
      name: {
        checks: rules.map((rule, i) =>
          predicateCheck({
            id: `c${String(i)}`,
            version: 1,
            code: 'hit',
            action: rule.action,
            matches: (text) => text.includes(rule.needle),
          })
        ),
        mask: { kind: 'alias', alias: (s) => `alias:${s.id}` },
      },
    })
  );

describe('write and display agree', () => {
  test('anything refused on write is masked on display', () => {
    assertProperty(
      'refused ⇒ masked',
      fc.property(arbPolicy, fc.string({ maxLength: 12 }), (policy, text) => {
        const moderator = createModerator(policy);
        const verdict = moderator.checkWrite('name', text);
        const shown = moderator.display('name', text, { id: 'p' });
        if (!verdict.allowed) expect(shown.masked).toBe(true);
        expect(shown.text).toBe(shown.masked ? 'alias:p' : text);
      })
    );
  });

  test('memoized verdicts equal fresh ones', () => {
    assertProperty(
      'cache is transparent',
      fc.property(
        arbPolicy,
        fc.array(fc.string({ maxLength: 6 }), { maxLength: 20 }),
        (policy, texts) => {
          const warm = createModerator(policy, { cacheSize: 2 });
          for (const text of texts) {
            const cold = createModerator(policy);
            expect(warm.inspect('name', text)).toEqual(
              cold.inspect('name', text)
            );
          }
        }
      )
    );
  });
});
