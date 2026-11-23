import type { LightCyclesFrameProfile } from './light-cycles-frame-probe';

/**
 * The devices Light Cycles' objectives are judged on: a duel against a bot
 * on a phone whose storage keeps up, and two people on their own devices on
 * one network, each for 20 virtual seconds at a 60 Hz display. A rider's
 * device shows the newest arena it has, never an older one held back, so a
 * person turns from what is current; on a device whose storage lags, steps
 * there keep its storage's unevenness.
 */
export const LIGHT_CYCLES_FRAME_PROFILES: Readonly<
  Record<string, LightCyclesFrameProfile>
> = {
  'bot on a phone': {
    play: 'bot',
    network: { latencyMeanMs: 0, latencyJitterMs: 0, dropProbability: 0 },
    storageMs: 4,
    timerLateMs: 1,
    displayHz: 60,
    seconds: 20,
  },
  'two devices on one network': {
    play: 'two-devices',
    network: { latencyMeanMs: 3, latencyJitterMs: 3, dropProbability: 0 },
    storageMs: 10,
    timerLateMs: 2,
    displayHz: 60,
    seconds: 20,
  },
};

/** Seeds each profile is ridden with. */
export const LIGHT_CYCLES_FRAME_SEEDS = [1, 2, 3] as const;
