import type { AuthorityPolicy } from './types'

export function designatedAuthority(peerId: string): AuthorityPolicy {
  return {
    isAuthority(localPeerId: string): boolean {
      return localPeerId === peerId
    },
  }
}

export function anyPeerAuthority(): AuthorityPolicy {
  return {
    isAuthority(): boolean {
      return true
    },
  }
}
