import { describe, expect, test } from 'bun:test';
import { SYNC_PROTOCOL_HEADER, SYNC_PROTOCOL_VERSION } from '../../protocol';
import { assertSyncProtocol } from '../../server/sync-protocol-gate';

describe('old client rejected at cut', () => {
  test('missing protocol header → upgrade_required (no wipe reason)', () => {
    const err = assertSyncProtocol(new Request('https://example.test/query'));
    expect(err).toEqual({ error: 'auth', reason: 'upgrade_required' });
  });

  test('protocol v1 header → upgrade_required', () => {
    const err = assertSyncProtocol(
      new Request('https://example.test/query', {
        headers: { [SYNC_PROTOCOL_HEADER]: '1' },
      })
    );
    expect(err).toEqual({ error: 'auth', reason: 'upgrade_required' });
  });

  test('protocol v2 header accepted', () => {
    expect(SYNC_PROTOCOL_VERSION).toBe(2);
    const err = assertSyncProtocol(
      new Request('https://example.test/query', {
        headers: { [SYNC_PROTOCOL_HEADER]: String(SYNC_PROTOCOL_VERSION) },
      })
    );
    expect(err).toBeNull();
  });
});
