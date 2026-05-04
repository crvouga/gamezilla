import { describe, expect, it } from 'bun:test';

import { createSessionPeerIdentity } from './peer-identity';

describe('createSessionPeerIdentity', () => {
  it('returns distinct peer ids on successive calls (ephemeral per tab)', () => {
    const a = createSessionPeerIdentity();
    const b = createSessionPeerIdentity();
    expect(a.peerId).not.toBe(b.peerId);
    expect(a.publicKeyB64).not.toBe(b.publicKeyB64);
  });
});
