import type { SyncPolicy } from './types'

export function designatedSyncPeer(peerId: string): SyncPolicy {
  return {
    isSyncSource(localPeerId: string): boolean {
      return localPeerId === peerId
    },
  }
}

export function anyPeerSync(): SyncPolicy {
  return {
    isSyncSource(): boolean {
      return true
    },
  }
}
