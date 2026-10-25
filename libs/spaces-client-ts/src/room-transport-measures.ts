import { createMetric } from '@pkgs/observability-root-shared-ts/metric-contract';

const roundTrip = createMetric({
  name: 'app.room.round_trip.duration',
  description: 'Room application-heartbeat round trip on the client clock',
  type: 'histogram',
  unit: 's',
  dimensions: {},
});

/** One aggregate series across rooms; no URL, topic, identity or game label. */
export function roomRoundTrip(milliseconds: number): void {
  roundTrip(milliseconds / 1000, {});
}
