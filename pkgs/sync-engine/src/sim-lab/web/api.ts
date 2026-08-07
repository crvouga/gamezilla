export type LiveShape = {
  readonly id: string;
  readonly kind: 'circle' | 'square' | 'triangle';
  readonly sort_key: number;
  readonly owner_id: string;
};

export type LabEdgeState = {
  readonly livePartitioned: boolean;
  readonly syncPartitioned: boolean;
  readonly liveHeld: boolean;
  readonly syncHeld: boolean;
  readonly faults: {
    readonly oneWayDelayMeanMs: number;
    readonly oneWayDelayJitterMs: number;
    readonly packetLossProbability: number;
    readonly packetReplayProbability: number;
    readonly reorderWindow: number;
    readonly partitionProbability: number;
    readonly unpartitionProbability: number;
  };
};

export type LabClientSnapshot = {
  readonly id: 'alice' | 'bob';
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

export type LabCommand = { readonly type: string } & Record<string, unknown>;

export async function postCommand(cmd: LabCommand): Promise<LabSnapshot> {
  const res = await fetch('/api/command', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`command failed: ${res.status}`);
  return res.json() as Promise<LabSnapshot>;
}

export function subscribeSnapshots(
  onSnap: (snap: LabSnapshot) => void
): () => void {
  const es = new EventSource('/api/events');
  const onMessage = (ev: MessageEvent) => {
    onSnap(JSON.parse(String(ev.data)) as LabSnapshot);
  };
  es.addEventListener('snapshot', onMessage as EventListener);
  return () => {
    es.removeEventListener('snapshot', onMessage as EventListener);
    es.close();
  };
}
