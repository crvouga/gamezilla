import type { PongFrameProfile } from './pong-frame-probe';

const LAN = { latencyMeanMs: 3, latencyJitterMs: 3, dropProbability: 0 };
const SAME_DEVICE = { latencyMeanMs: 0, latencyJitterMs: 0, dropProbability: 0 };

/**
 * The devices Pong's objectives are judged on: a bot game on a phone whose
 * storage keeps up, on a slow phone (storage and timers both late), and two
 * people on their own devices on one network. Each runs 20 virtual seconds
 * of play at a 60 Hz display.
 */
export const PONG_FRAME_PROFILES: Readonly<Record<string, PongFrameProfile>> = {
  'bot on a phone': {
    play: 'bot',
    network: SAME_DEVICE,
    storageMs: 4,
    timerLateMs: 1,
    displayHz: 60,
    seconds: 20,
  },
  'bot on a slow phone': {
    play: 'bot',
    network: SAME_DEVICE,
    storageMs: 30,
    timerLateMs: 4,
    displayHz: 60,
    seconds: 20,
  },
  'two devices on one network': {
    play: 'two-devices',
    network: LAN,
    storageMs: 10,
    timerLateMs: 2,
    displayHz: 60,
    seconds: 20,
  },
};

/** Seeds each profile is played with. */
export const PONG_FRAME_SEEDS = [1, 2, 3] as const;
