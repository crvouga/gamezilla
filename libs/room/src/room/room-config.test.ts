import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Assert } from '@gamezilla/lib/assert';
import { InMemoryRoomPersistence } from '../persistence/persistence-in-memory';
import { Room } from './room';
import { InMemoryBus, InMemoryTransport } from '../transport';
import { TicTacToeModule } from '../testkit/fixtures/tic-tac-toe.module';
import { TestCrashHandler } from '../testkit/test-crash-handler';
import {
  testPeerForLabel,
  ticTacToeThreePeers,
} from '../testkit/tic-tac-toe-peers';
import { normalizeRoomInit } from './normalize-init';

let disposeCrashHandler: () => void;
beforeAll(() => {
  disposeCrashHandler = Assert.registerCrashHandler(new TestCrashHandler());
});
afterAll(() => disposeCrashHandler());

describe('Room config', () => {
  it('host role derives peerId from secretSeed', () => {
    const F = ticTacToeThreePeers();
    const bus = new InMemoryBus();
    const p = F.peers.playerX;
    const transport = new InMemoryTransport(bus, p.peerId);
    const store = Room.open({
      module: TicTacToeModule,
      topic: 'room-host-peerid',
      roomSecret: F.roomSecret,
      secretSeed: p.secretSeed,
      transport,
      persistence: new InMemoryRoomPersistence(),
      role: {
        type: 'host',
        initialMembership: F.initialMembership,
        initialMemberPublicKeys: F.initialMemberPublicKeys,
      },
    });
    expect(store.peerId).toBe(p.peerId);
    expect(store.bootstrapKind).toBe('genesis');
    store.destroy();
    transport.destroy();
    bus.destroy();
  });

  it('join role uses roomSnapshot and join bootstrap', () => {
    const pA = testPeerForLabel('join-room-a');
    const pB = testPeerForLabel('join-room-b');
    const joiner = testPeerForLabel('join-room-new');
    const bus = new InMemoryBus();
    const transport = new InMemoryTransport(bus, joiner.peerId);
    const store = Room.open({
      module: TicTacToeModule,
      topic: 'room-join-bootstrap',
      roomSecret: 'join-room-secret',
      secretSeed: joiner.secretSeed,
      transport,
      persistence: new InMemoryRoomPersistence(),
      role: {
        type: 'join',
        roomSnapshot: {
          initialMembership: { [pA.peerId]: 2, [pB.peerId]: 1 },
          initialMemberPublicKeys: {
            [pA.peerId]: pA.publicKeyB64,
            [pB.peerId]: pB.publicKeyB64,
          },
        },
      },
    });
    expect(store.peerId).toBe(joiner.peerId);
    expect(store.bootstrapKind).toBe('join');
    store.destroy();
    transport.destroy();
    bus.destroy();
  });

  it('normalizeRoomInit maps room config to core fields', () => {
    const F = ticTacToeThreePeers();
    const p = F.peers.authority;
    const bus = new InMemoryBus();
    const transport = new InMemoryTransport(bus, p.peerId);
    const persistence = new InMemoryRoomPersistence();
    const n = normalizeRoomInit({
      topic: 'norm-topic',
      roomSecret: F.roomSecret,
      secretSeed: p.secretSeed,
      transport,
      persistence,
      role: {
        type: 'host',
        initialMembership: F.initialMembership,
        initialMemberPublicKeys: F.initialMemberPublicKeys,
      },
      timeoutMs: 7000,
    });
    expect(n.peerId).toBe(p.peerId);
    expect(n.bootstrap.kind).toBe('genesis');
    expect(n.timeoutMs).toBe(7000);
    expect(n.persistence).toBe(persistence);
    transport.destroy();
    bus.destroy();
  });
});
