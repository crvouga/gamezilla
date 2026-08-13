/** Fine-grained simulation event log (UI + wire + knobs). */

export type SimulationEventKind =
  | 'ui.tap'
  | 'ui.tapAt'
  | 'ui.typeText'
  | 'ui.clearText'
  | 'ui.pressKey'
  | 'ui.scroll'
  | 'ui.waitFor'
  | 'ui.launch'
  | 'ui.close'
  | 'ui.step'
  | 'ui.navigateBack'
  | 'ui.nav.open'
  | 'http.request'
  | 'http.response'
  | 'pubsub.emit'
  | 'pubsub.receive'
  | 'pubsub.redeliver'
  | 'node.spawn'
  | 'node.crash'
  | 'node.restart'
  | 'node.corrupt'
  | 'node.wipe'
  | 'node.pause'
  | 'node.resume'
  | 'node.skewClock'
  | 'node.crashOn'
  | 'edge.partition'
  | 'edge.heal'
  | 'edge.hold'
  | 'edge.release'
  | 'edge.drop'
  | 'edge.duplicate'
  | 'edge.reorder'
  | 'edge.delay'
  | 'edge.failWith'
  | 'broker.subscriptionDrop'
  | 'fuzz.inject'
  | 'frame';

export type SimulationEvent = {
  readonly id: string;
  readonly kind: SimulationEventKind;
  readonly atMs: number;
  readonly nodeId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly title?: string;
  readonly detail?: string;
  readonly status?: 'ok' | 'error' | 'dropped' | 'held';
  readonly meta?: Readonly<Record<string, unknown>>;
};

export type EventMatcher = {
  readonly kind?: SimulationEventKind | readonly SimulationEventKind[];
  readonly nodeId?: string;
  readonly from?: string;
  readonly to?: string;
};
