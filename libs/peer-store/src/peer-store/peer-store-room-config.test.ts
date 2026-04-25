import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Assert } from '@gamezilla/lib/assert';
import { PeerStore } from './peer-store';
import { InMemoryBus, InMemoryTransport } from '../transport';
import { TicTacToeModule } from '../testing/fixtures/tic-tac-toe.module';
import { TestCrashHandler } from '../testing/test-crash-handler';
import { testPeerForLabel, ticTacToeThreePeers } from '../testing/tictactoe-peers';

let disposeCrashHandler: () => void;
beforeAll(() => {
  disposeCrashHandler = Assert.registerCrashHandler(new TestCrashHandler());
});
afterAll(() => disposeCrashHandler());

describe('PeerStore room config', () => {
  it('host role derives peerId from secretSeed', () => {
    const F = ticTacToeThreePeers();
    const bus = new InMemoryBus();
    const p = F.peers.playerX;
    const transport = new InMemoryTransport(bus, p.peerId);
    const store = new PeerStore(TicTacToeModule, {
      topic: 'room-host-peerid',
      roomSecret: F.roomSecret,
      secretSeed: p.secretSeed,
      transport,
      role: {
        type: 'host',
        initialMembership: F.initialMembership,
        initialMemberPublicKeys: F.initialMemberPublicKeys,
      },
      autoTrustElection: false,
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
    const store = new PeerStore(TicTacToeModule, {
      topic: 'room-join-bootstrap',
      roomSecret: 'join-room-secret',
      secretSeed: joiner.secretSeed,
      transport,
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
      autoTrustElection: false,
    });
    expect(store.peerId).toBe(joiner.peerId);
    expect(store.bootstrapKind).toBe('join');
    store.destroy();
    transport.destroy();
    bus.destroy();
  });

  it('default trust election completes for synced host room', async () => {
    const F = ticTacToeThreePeers();
    const bus = new InMemoryBus();
    const topic = 'room-election-host';
    const errors: unknown[] = [];
    const stores: PeerStore[] = [];
    const transports: InMemoryTransport[] = [];
    for (const key of ['authority', 'playerX', 'playerO'] as const) {
      const p = F.peers[key];
      const transport = new InMemoryTransport(bus, p.peerId);
      transports.push(transport);
      stores.push(
        new PeerStore(
          TicTacToeModule,
          {
            topic,
            roomSecret: F.roomSecret,
            secretSeed: p.secretSeed,
            transport,
            role: {
              type: 'host',
              initialMembership: F.initialMembership,
              initialMemberPublicKeys: F.initialMemberPublicKeys,
            },
            trustElectionTimeoutMs: 5000,
          },
          { onError: (e) => errors.push(e) },
        ),
      );
    }
    bus.flush();
    await new Promise<void>((resolve) => {
      setImmediate(() => resolve());
    });
    bus.flush();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 150);
    });
    expect(errors).toHaveLength(0);
    for (const s of stores) s.destroy();
    for (const t of transports) t.destroy();
    bus.destroy();
  });
});
