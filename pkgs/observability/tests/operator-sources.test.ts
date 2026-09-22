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
});
