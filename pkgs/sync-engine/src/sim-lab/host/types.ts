import type { SimFaultOptions } from '../../sim/faults';
import { RELIABLE_FAULTS } from '../../sim/faults';
import type { LiveShape, ShapeKind } from '../../sim/shapes-app';
import { SHAPE_KINDS } from '../../sim/shapes-app';
import type { SimTraffic } from '../../sim/traffic';

export type LabClientId = 'alice' | 'bob';

export type LabEdgeState = {
  readonly livePartitioned: boolean;
  readonly syncPartitioned: boolean;
  readonly liveHeld: boolean;
  readonly syncHeld: boolean;
  readonly faults: SimFaultOptions;
};

export type LabClientSnapshot = {
  readonly id: LabClientId;
  readonly actorId: string;
  readonly shapes: readonly LiveShape[];
  readonly online: boolean;
  readonly foreground: boolean;
  readonly connected: boolean;
  readonly syncStatus: {
    readonly connection: string;
    readonly online: boolean;
    readonly hasSynced: boolean;
    readonly lastError: string | null;
  };
  readonly skewMs: number;
  readonly edge: LabEdgeState;
};

export type LabAction = {
  readonly at: number;
  readonly label: string;
  readonly ok: boolean;
  readonly error?: string;
};

export type LabSnapshot = {
  readonly open: boolean;
  readonly seed: string | null;
  readonly now: number;
  readonly rowImageFanout: boolean;
  readonly liveResendOnReconnect: boolean;
  readonly alice: LabClientSnapshot | null;
  readonly bob: LabClientSnapshot | null;
  readonly serverShapes: readonly LiveShape[];
  readonly converged: boolean | null;
  readonly lastError: string | null;
  readonly actions: readonly LabAction[];
};

export type LabCommand =
  | {
      readonly type: 'openWorld';
      readonly seed?: string | number;
      readonly rowImageFanout?: boolean;
      readonly liveResendOnReconnect?: boolean;
    }
  | { readonly type: 'disposeWorld' }
  | {
      readonly type: 'setOnline';
      readonly clientId: LabClientId;
      readonly value: boolean;
    }
  | {
      readonly type: 'setForeground';
      readonly clientId: LabClientId;
      readonly value: boolean;
    }
  | { readonly type: 'connect'; readonly clientId: LabClientId }
  | { readonly type: 'disconnect'; readonly clientId: LabClientId }
  | { readonly type: 'crash'; readonly clientId: LabClientId }
  | { readonly type: 'restart'; readonly clientId: LabClientId }
  | {
      readonly type: 'setClockSkew';
      readonly clientId: LabClientId;
      readonly skewMs: number;
    }
  | {
      readonly type: 'partition';
      readonly clientId: LabClientId;
      readonly traffic: SimTraffic;
    }
  | {
      readonly type: 'unpartition';
      readonly clientId: LabClientId;
      readonly traffic: SimTraffic;
    }
  | { readonly type: 'heal'; readonly clientId: LabClientId }
  | {
      readonly type: 'hold';
      readonly clientId: LabClientId;
      readonly traffic: SimTraffic;
    }
  | {
      readonly type: 'release';
      readonly clientId: LabClientId;
      readonly traffic: SimTraffic;
    }
  | {
      readonly type: 'setFaults';
      readonly clientId: LabClientId;
      readonly traffic: SimTraffic;
      readonly faults: Partial<SimFaultOptions>;
    }
  | { readonly type: 'clearFaults'; readonly clientId: LabClientId }
  | {
      readonly type: 'addShape';
      readonly clientId: LabClientId;
      readonly kind?: ShapeKind;
    }
  | {
      readonly type: 'removeShape';
      readonly clientId: LabClientId;
      readonly shapeId: string;
    }
  | {
      readonly type: 'reorderShapes';
      readonly clientId: LabClientId;
      readonly orderedIds: readonly string[];
    }
  | { readonly type: 'shuffleShapes'; readonly clientId: LabClientId }
  | { readonly type: 'runFor'; readonly ms: number }
  | { readonly type: 'runUntilIdle' }
  | { readonly type: 'assertConverged' }
  | { readonly type: 'checkInvariants' };

export const EMPTY_EDGE: LabEdgeState = {
  livePartitioned: false,
  syncPartitioned: false,
  liveHeld: false,
  syncHeld: false,
  faults: RELIABLE_FAULTS,
};

export const EMPTY_SNAPSHOT: LabSnapshot = {
  open: false,
  seed: null,
  now: 0,
  rowImageFanout: true,
  liveResendOnReconnect: false,
  alice: null,
  bob: null,
  serverShapes: [],
  converged: null,
  lastError: null,
  actions: [],
};

export { RELIABLE_FAULTS, SHAPE_KINDS };
