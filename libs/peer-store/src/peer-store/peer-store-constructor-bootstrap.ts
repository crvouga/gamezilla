import { Assert } from '@gamezilla/lib/assert';
import type { LogEntry } from '../persistence/log-entry';
import { seedAllRemotePeersLiveness } from './authority-monitor';
import { bootstrapGenesisCommittedState } from './peer-store-genesis';
import { installJoinGenesisKeys } from './peer-store-join-keys';
import type {
  PeerBootstrap,
  PeerStoreSecurityConfig,
  State,
  StoreModule,
} from './peer-store-types';

const crash: Assert = Assert.crash();

export type PeerStoreBootstrapConfig = {
  peerId: string;
  bootstrap: PeerBootstrap;
  security: PeerStoreSecurityConfig;
};

export type JoinGenesisSnapshot = {
  initialMembership: Record<string, number>;
  initialMemberPublicKeys: Record<string, string>;
};

export type ConstructorBootstrapResult = {
  committed_state: State;
  membership: Map<string, number>;
  committed_entries: LogEntry[];
  last_committed_log_seq: number;
  bootstrapKind: 'genesis' | 'join';
  joinGenesis: JoinGenesisSnapshot | null;
  synced: boolean;
};

export function runPeerStoreConstructorBootstrap(
  module: StoreModule,
  config: PeerStoreBootstrapConfig,
  memberPublicKeys: Map<string, Uint8Array>,
  last_seen: Map<string, number>,
): ConstructorBootstrapResult {
  let committed_state = module.initialState();
  crash.record(
    committed_state,
    'initialState must return a plain object',
  );

  const bootstrapKind = config.bootstrap.kind;
  let synced = bootstrapKind === 'genesis';
  let joinGenesis: JoinGenesisSnapshot | null = null;
  let membership = new Map<string, number>();
  let committed_entries: LogEntry[] = [];
  let last_committed_log_seq = 0;

  if (bootstrapKind === 'genesis') {
    const snap = bootstrapGenesisCommittedState(
      module,
      memberPublicKeys,
      config.peerId,
      config.bootstrap,
    );
    membership = snap.membership;
    committed_entries = snap.committed_entries;
    committed_state = snap.committed_state;
    last_committed_log_seq = snap.last_committed_log_seq;
    seedAllRemotePeersLiveness({
      peerId: config.peerId,
      last_seen,
      membership,
    });
  } else {
    const jg = config.bootstrap;
    joinGenesis = {
      initialMembership: { ...jg.initialMembership },
      initialMemberPublicKeys: { ...jg.initialMemberPublicKeys },
    };
    installJoinGenesisKeys(
      {
        peerId: config.peerId,
        security: config.security,
        memberPublicKeys,
        last_seen,
      },
      jg,
    );
  }

  return {
    committed_state,
    membership,
    committed_entries,
    last_committed_log_seq,
    bootstrapKind,
    joinGenesis,
    synced,
  };
}
