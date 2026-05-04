import { useEffect, useMemo, useState } from 'react';

import { useSpaceRoomWire } from './space-room-wire-context';

type PresencePeer = { peerId: string; accountId: string };

function isPresencePayload(v: unknown): v is {
  ch: 'presence';
  kind: string;
  peerId?: string;
  accountId?: string;
  peers?: unknown;
} {
  return (
    v !== null &&
    typeof v === 'object' &&
    'ch' in v &&
    (v as { ch?: unknown }).ch === 'presence' &&
    'kind' in v &&
    typeof (v as { kind?: unknown }).kind === 'string'
  );
}

function parseSnapshotPeers(peers: unknown): PresencePeer[] {
  if (!Array.isArray(peers)) return [];
  const out: PresencePeer[] = [];
  for (const row of peers) {
    if (
      row !== null &&
      typeof row === 'object' &&
      'peerId' in row &&
      'accountId' in row &&
      typeof (row as { peerId?: unknown }).peerId === 'string' &&
      typeof (row as { accountId?: unknown }).accountId === 'string'
    ) {
      out.push({
        peerId: (row as { peerId: string }).peerId,
        accountId: (row as { accountId: string }).accountId,
      });
    }
  }
  return out;
}

function snapshotMap(peers: unknown): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of parseSnapshotPeers(peers)) {
    m.set(p.peerId, p.accountId);
  }
  return m;
}

function applyJoin(
  prev: Map<string, string>,
  peerId: unknown,
  accountId: unknown
): Map<string, string> {
  if (
    typeof peerId === 'string' &&
    peerId.length > 0 &&
    typeof accountId === 'string' &&
    accountId.length > 0
  ) {
    return new Map(prev).set(peerId, accountId);
  }
  return prev;
}

function applyLeave(
  prev: Map<string, string>,
  peerId: unknown
): Map<string, string> {
  if (typeof peerId !== 'string' || peerId.length === 0) return prev;
  const next = new Map(prev);
  next.delete(peerId);
  return next;
}

function applyPresenceMessage(
  prev: Map<string, string>,
  msg: {
    kind: string;
    peerId?: string;
    accountId?: string;
    peers?: unknown;
  }
): Map<string, string> {
  if (msg.kind === 'snapshot') return snapshotMap(msg.peers);
  if (msg.kind === 'join') return applyJoin(prev, msg.peerId, msg.accountId);
  if (msg.kind === 'leave') return applyLeave(prev, msg.peerId);
  return prev;
}

export function useSpacePresence(): {
  peersByAccountId: Map<string, string[]>;
  selfPeerId: string | null;
} {
  const { transport, sessionPeerId } = useSpaceRoomWire();
  const [peerAccountByPeerId, setPeerAccountByPeerId] = useState<
    Map<string, string>
  >(() => new Map());

  useEffect(() => {
    if (transport === null) {
      setPeerAccountByPeerId(new Map());
      return;
    }
    return transport.subscribePresence((msg) => {
      if (!isPresencePayload(msg)) return;
      setPeerAccountByPeerId((prev) => applyPresenceMessage(prev, msg));
    });
  }, [transport]);

  const peersByAccountId = useMemo(() => {
    const acc = new Map<string, string[]>();
    for (const [peerId, accountId] of peerAccountByPeerId) {
      const list = acc.get(accountId) ?? [];
      list.push(peerId);
      acc.set(accountId, list);
    }
    return acc;
  }, [peerAccountByPeerId]);

  return { peersByAccountId, selfPeerId: sessionPeerId };
}
