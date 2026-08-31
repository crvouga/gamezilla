import type { RoomCrashEvent } from '../boundary-faults';
import type {
  RoomFaultProfile,
  RoomNetDirectionalState,
  RoomNetLinkState,
} from '../network';

export type DomainOp = {
  readonly kind: 'domain';
  readonly clientId: string;
  readonly command: string;
  readonly args: Record<string, unknown>;
};

export type LibraryAction =
  | { readonly kind: 'disconnect'; readonly clientId: string }
  | { readonly kind: 'connect'; readonly clientId: string }
  | { readonly kind: 'hold'; readonly clientId: string }
  | { readonly kind: 'release'; readonly clientId: string }
  | { readonly kind: 'down'; readonly clientId: string }
  | { readonly kind: 'heal' }
  | { readonly kind: 'idle'; readonly ms: number }
  | { readonly kind: 'takeOver'; readonly clientId: string }
  | { readonly kind: 'crash'; readonly clientId: string }
  | { readonly kind: 'restart'; readonly clientId: string }
  | { readonly kind: 'serverCrash' }
  | { readonly kind: 'serverRestart' }
  | { readonly kind: 'clearLocalData'; readonly clientId: string }
  | {
      readonly kind: 'setFaults';
      readonly clientId: string;
      readonly faults: Partial<RoomFaultProfile>;
    }
  | {
      readonly kind: 'asymmetricLink';
      readonly clientId: string;
      readonly link: RoomNetDirectionalState;
    }
  | {
      readonly kind: 'armCrashAt';
      readonly clientId: string;
      readonly event: RoomCrashEvent;
    }
  | {
      readonly kind: 'injectToServer';
      readonly clientId: string;
      readonly raw: unknown;
      readonly direct?: boolean;
    }
  | {
      readonly kind: 'injectFromServer';
      readonly clientId: string;
      readonly raw: unknown;
    }
  | {
      readonly kind: 'addSpectator';
      readonly id: string;
      readonly identity?: string;
      readonly clientId?: string;
    }
  | {
      readonly kind: 'setLink';
      readonly clientId: string;
      readonly link: RoomNetLinkState;
    };

export type RoomDstAction = LibraryAction | DomainOp;

export function isDomainOp(action: RoomDstAction): action is DomainOp {
  return action.kind === 'domain';
}

export function isLibraryAction(
  action: RoomDstAction
): action is LibraryAction {
  return action.kind !== 'domain';
}
