import { describe, expect, test } from 'bun:test';
import type { SpaceRoomWebSocketUrlArgs } from '@libs/spaces-shared/space-room-url';
import { apiUrlToRoomWebSocketUrl } from '@libs/spaces-shared/space-room-url';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

const arbOptionalToken = fc.option(
  fc.oneof(fc.constant(''), fc.string({ minLength: 1, maxLength: 24 })),
  { nil: null }
);

const arbArgs: fc.Arbitrary<SpaceRoomWebSocketUrlArgs> = fc.record({
  apiUrl: fc
    .tuple(
      fc.constantFrom('http', 'https'),
      fc.domain(),
      fc.option(fc.integer({ min: 1, max: 65_535 }), { nil: null }),
      fc.constantFrom('', '/', '/v1', '/v1/')
    )
    .map(
      ([scheme, host, port, path]) =>
        `${scheme}://${host}${port === null ? '' : `:${port}`}${path}`
    ),
  topic: fc.string({ maxLength: 40 }),
  module: fc.constantFrom('space', 'chess-match'),
  sessionToken: arbOptionalToken,
  installId: arbOptionalToken,
  clientId: arbOptionalToken,
});

function present(value: string | null): value is string {
  return value !== null && value.length > 0;
}

describe('apiUrlToRoomWebSocketUrl', () => {
  test('upgrades the scheme and keeps the API path under /api/room', () => {
    assertProperty(
      'ws url shape',
      fc.property(arbArgs, (args) => {
        const url = new URL(apiUrlToRoomWebSocketUrl(args));
        const api = new URL(args.apiUrl);
        expect(url.protocol).toBe(api.protocol === 'https:' ? 'wss:' : 'ws:');
        expect(url.host).toBe(api.host);
        expect(url.pathname).toBe(
          `${api.pathname.replace(/\/$/, '')}/api/room`
        );
      })
    );
  });

  test('query params round-trip and appear only when non-empty', () => {
    assertProperty(
      'ws url params',
      fc.property(arbArgs, (args) => {
        const params = new URL(apiUrlToRoomWebSocketUrl(args)).searchParams;
        expect(params.get('topic')).toBe(args.topic);
        expect(params.get('module')).toBe(args.module);
        expect(params.get('token')).toBe(
          present(args.sessionToken) ? args.sessionToken : null
        );
        expect(params.get('anonId')).toBe(
          present(args.installId) ? args.installId : null
        );
        expect(params.get('clientId')).toBe(
          present(args.clientId) ? args.clientId : null
        );
      })
    );
  });
});
