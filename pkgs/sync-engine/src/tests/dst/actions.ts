import type { SimCrashEvent, SimHttpFault } from '../../sim/boundary-faults';
import type { SimAuthStatus } from '../../sim/client-factory';
import type { SimFaultOptions } from '../../sim/faults';
import type { SimTraffic } from '../../sim/traffic';

export type DomainOp = {
  readonly kind: 'domain';
  readonly clientId: string;
  readonly mutation: string;
  readonly args: Record<string, unknown>;
};

export type ServerOp = {
  readonly kind: 'server';
  readonly name: string;
  readonly args: Record<string, unknown>;
};

export type LibraryAction =
  | { readonly kind: 'offline'; readonly clientId: string }
  | { readonly kind: 'online'; readonly clientId: string }
  | { readonly kind: 'disconnect'; readonly clientId: string }
  | { readonly kind: 'connect'; readonly clientId: string }
  | { readonly kind: 'background'; readonly clientId: string }
  | { readonly kind: 'foreground'; readonly clientId: string }
  | {
      readonly kind: 'partition';
      readonly nodeId: string;
      readonly traffic: SimTraffic;
    }
  | { readonly kind: 'heal' }
  | { readonly kind: 'idle'; readonly ms: number }
  | {
      readonly kind: 'skew';
      readonly nodeId: string;
      readonly skewMs: number;
    }
  | { readonly kind: 'crash'; readonly clientId: string }
  | { readonly kind: 'restart'; readonly clientId: string }
  | {
      readonly kind: 'hold';
      readonly nodeId: string;
      readonly traffic: SimTraffic;
    }
  | {
      readonly kind: 'release';
      readonly nodeId: string;
      readonly traffic: SimTraffic;
    }
  | {
      readonly kind: 'setFaults';
      readonly nodeId: string;
      readonly traffic: 'live';
      readonly faults: Partial<SimFaultOptions>;
    }
  | {
      readonly kind: 'armHttpFault';
      readonly clientId: string;
      readonly fault: SimHttpFault;
    }
  | {
      readonly kind: 'armCrashAt';
      readonly clientId: string;
      readonly event: SimCrashEvent;
    }
  | { readonly kind: 'publishFault'; readonly count: number | 'next' }
  | { readonly kind: 'auth'; readonly clientId: string; readonly status: SimAuthStatus }
  | { readonly kind: 'clearLocalData'; readonly clientId: string; readonly reason: string }
  | {
      readonly kind: 'subscribe';
      readonly clientId: string;
      readonly queryName: string;
      readonly params: Record<string, unknown>;
    };

export type DstAction = LibraryAction | DomainOp | ServerOp;

export function isDomainOp(action: DstAction): action is DomainOp {
  return action.kind === 'domain';
}

export function isServerOp(action: DstAction): action is ServerOp {
  return action.kind === 'server';
}

export function isLibraryAction(action: DstAction): action is LibraryAction {
  return !isDomainOp(action) && !isServerOp(action);
}
