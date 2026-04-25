import { createHash } from 'node:crypto';
import {
  encodeKeyB64,
  peerIdFromPublicKey,
  publicKeyFromSecretSeed,
} from '../store/security/peer-crypto';

export type TicTacToeTestPeer = {
  label: string;
  peerId: string;
  secretSeed: Uint8Array;
  publicKeyB64: string;
};

/**
 * Deterministic Ed25519 identity for tests and simulators (label → key material).
 */
export function testPeerForLabel(label: string): TicTacToeTestPeer {
  const secretSeed = createHash('sha256')
    .update(`peer-store-test-peer:${label}`)
    .digest()
    .subarray(0, 32);
  const publicKey = publicKeyFromSecretSeed(secretSeed);
  const peerId = peerIdFromPublicKey(publicKey);
  return {
    label,
    peerId,
    secretSeed,
    publicKeyB64: encodeKeyB64(publicKey),
  };
}

/** Default three-player tic-tac-toe fixture with authority + two players. */
export function ticTacToeThreePeers(): {
  topic: string;
  roomSecret: string;
  peers: {
    authority: TicTacToeTestPeer;
    playerX: TicTacToeTestPeer;
    playerO: TicTacToeTestPeer;
  };
  initialMembership: Record<string, number>;
  initialMemberPublicKeys: Record<string, string>;
  peerSecretSeeds: Record<string, Uint8Array>;
} {
  const authority = testPeerForLabel('authority');
  const playerX = testPeerForLabel('player-x');
  const playerO = testPeerForLabel('player-o');
  const initialMembership: Record<string, number> = {
    [authority.peerId]: 3,
    [playerX.peerId]: 1,
    [playerO.peerId]: 1,
  };
  const initialMemberPublicKeys: Record<string, string> = {
    [authority.peerId]: authority.publicKeyB64,
    [playerX.peerId]: playerX.publicKeyB64,
    [playerO.peerId]: playerO.publicKeyB64,
  };
  const peerSecretSeeds: Record<string, Uint8Array> = {
    [authority.peerId]: authority.secretSeed,
    [playerX.peerId]: playerX.secretSeed,
    [playerO.peerId]: playerO.secretSeed,
  };
  return {
    topic: 'tictactoe-test-topic',
    /** Shared match secret; bind all wire signatures to this + topic. */
    roomSecret: 'tictactoe-test-room-secret',
    peers: { authority, playerX, playerO },
    initialMembership,
    initialMemberPublicKeys,
    peerSecretSeeds,
  };
}
