import { describe, expect, test } from 'bun:test';
import { LookupIdentityResolver } from '@pkgs/observability/query';

describe('operator query sources', () => {
  test('identity lookup normalizes facts and returns only durable user ids', async () => {
    const seen: string[] = [];
    const resolver = new LookupIdentityResolver({
      async byUsername(value) {
        seen.push(`username:${value}`);
        return 'user-1';
      },
      async byEmail(value) {
        seen.push(`email:${value}`);
        return 'user-2';
      },
    });
    expect(await resolver.resolve(' Alice ')).toEqual({
      userId: 'user-1',
      matchedAs: 'username',
    });
    expect(await resolver.resolve('ALICE@EXAMPLE.COM')).toEqual({
      userId: 'user-2',
      matchedAs: 'email',
    });
    expect(seen).toEqual(['username:alice', 'email:alice@example.com']);
  });

  test('a display name resolves every matching account and leaves a username alone', async () => {
    const seen: string[] = [];
    const resolver = new LookupIdentityResolver({
      async byUsername(value) {
        seen.push(`username:${value}`);
        return value === 'alice' ? 'user-1' : null;
      },
      async byEmail() {
        return null;
      },
      async byName(value) {
        seen.push(`name:${value}`);
        return value === 'chris vouga' ? ['user-chris', 'user-other'] : [];
      },
    });
    expect(await resolver.resolve(' Alice ')).toEqual({
      userId: 'user-1',
      matchedAs: 'username',
    });
    expect(await resolver.resolvePeople('Chris Vouga')).toEqual([
      { userId: 'user-chris', matchedAs: 'name' },
      { userId: 'user-other', matchedAs: 'name' },
    ]);
    expect(seen).toEqual(['username:alice', 'name:chris vouga']);
  });
});
