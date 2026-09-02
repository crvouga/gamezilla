import { type KnobDef, knob } from '@pkgs/determinism';
import fc from 'fast-check';

export type WorldKnobs = {
  readonly rowImageFanout: boolean;
  readonly liveResendOnReconnect: boolean;
  readonly bufferOutboundLive: boolean;
  readonly clientCount: number;
};

export const ROW_IMAGE_FANOUT = knob(true, fc.boolean());
export const LIVE_RESEND_ON_RECONNECT = knob(false, fc.boolean());
export const BUFFER_OUTBOUND_LIVE = knob(false, fc.boolean());
export const CLIENT_COUNT = knob(2, fc.integer({ min: 2, max: 3 }));

export const SYNC_SYSTEM_KNOBS = {
  rowImageFanout: ROW_IMAGE_FANOUT,
  liveResendOnReconnect: LIVE_RESEND_ON_RECONNECT,
  bufferOutboundLive: BUFFER_OUTBOUND_LIVE,
  clientCount: CLIENT_COUNT,
} as const;

export type SyncKnobDefs = typeof SYNC_SYSTEM_KNOBS;

export const arbSeed = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: 1_000_000 });

export function arbKnobs(): fc.Arbitrary<WorldKnobs> {
  return fc.record({
    rowImageFanout: fc.boolean(),
    liveResendOnReconnect: fc.boolean(),
    bufferOutboundLive: fc.boolean(),
    clientCount: fc.integer({ min: 2, max: 3 }),
  });
}

export function knobValuesFromCatalog(
  knob: <T extends boolean | number>(def: KnobDef<T>) => T
): WorldKnobs {
  return {
    rowImageFanout: knob(ROW_IMAGE_FANOUT),
    liveResendOnReconnect: knob(LIVE_RESEND_ON_RECONNECT),
    bufferOutboundLive: knob(BUFFER_OUTBOUND_LIVE),
    clientCount: knob(CLIENT_COUNT),
  };
}
