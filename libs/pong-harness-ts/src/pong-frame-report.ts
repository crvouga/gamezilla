import {
  type Percentiles,
  percentiles,
} from '@libs/game-session-harness-ts/realtime-device';
import { pongConfig } from '@libs/pong-shared-ts/pong-config';
import type { PongState } from '@libs/pong-shared-ts/pong-state';

const config = pongConfig();
const FACE = config.paddleInset + config.paddleWidth / 2 + config.ballRadius;

/** What one display frame showed: the court, and which authority tick it belongs to. */
export type FrameSample = {
  readonly at: number;
  readonly state: PongState | null;
  readonly tick: number | null;
  /** The paddle this device's person guides, and the direction they held as the frame was drawn. */
  readonly own: 'left' | 'right';
  readonly held: -1 | 0 | 1;
};

/** The frames one display showed, judged as a person watching them would. */
export type PongFrameReport = {
  /** Frames where the ball was in flight. */
  readonly motionFrames: number;
  /** Share of those frames that showed the ball where the previous frame did. */
  readonly frozenRatio: number;
  /** Share of those frames whose ball step was off by more than half a frame's travel. */
  readonly snapRatio: number;
  /** How far each frame's ball step was from one frame's travel, as a share of it. */
  readonly stepError: Percentiles;
  /** Frames where the person held their paddle on its way, clear of the court's ends. */
  readonly ownFrames: number;
  /** Share of those frames where their paddle leapt (over 1.5 frames' travel) or stalled (under half). */
  readonly ownSnapRatio: number;
  /** Bounces off a wall or paddle shown between two frames. */
  readonly bounces: number;
  /** Share of those bounces where neither frame showed the ball within one frame's travel of what it bounced off. */
  readonly missedContactRatio: number;
  /** How close the shown ball came to what it bounced off, as a share of one frame's travel. */
  readonly contactGap: Percentiles;
  /** Milliseconds from the authority reaching a court to the display showing it. */
  readonly stateAgeMs: Percentiles;
  /** Milliseconds from a held control to the display showing the paddle move. */
  readonly inputLatencyMs: Percentiles;
  /** Milliseconds between courts arriving at the device. */
  readonly arrivalIntervalMs: Percentiles;
  readonly errors: number;
  readonly evidence: PongFrameEvidence;
};

/**
 * How near the ball was shown to what it bounced off between two frames, in
 * frames of travel; null when nothing was bounced off or the rally changed.
 */
function contactGap(
  before: PongState,
  after: PongState,
  elapsedMs: number
): number | null {
  if (
    before.phase !== 'playing' ||
    after.phase !== 'playing' ||
    before.feedback.points !== after.feedback.points ||
    before.feedback.serves !== after.feedback.serves
  )
    return null;
  const travel =
    (Math.max(
      Math.hypot(before.ball.vx, before.ball.vy),
      Math.hypot(after.ball.vx, after.ball.vy)
    ) *
      elapsedMs) /
    1000;
  if (travel === 0) return null;
  // Whichever it bounced off, the nearer of the two shown balls tells.
  const near = (value: number, low: number, high: number) =>
    Math.min(Math.abs(value - low), Math.abs(value - high));
  if (after.feedback.paddles > before.feedback.paddles)
    return (
      Math.min(
        near(before.ball.x, FACE, config.width - FACE),
        near(after.ball.x, FACE, config.width - FACE)
      ) / travel
    );
  if (after.feedback.walls > before.feedback.walls) {
    const top = config.ballRadius;
    const bottom = config.height - config.ballRadius;
    return (
      Math.min(near(before.ball.y, top, bottom), near(after.ball.y, top, bottom)) /
      travel
    );
  }
  return null;
}

/**
 * How far the person's own paddle leapt beyond or fell short of its pace
 * between two frames while they held it on its way, as a share of one
 * frame's travel; null when they held nothing or it neared an end. A frame
 * just pressed may start anywhere from rest to full speed.
 */
function ownStep(before: FrameSample, after: FrameSample): number | null {
  if (
    before.state === null ||
    after.state === null ||
    before.state.phase !== 'playing' ||
    after.state.phase !== 'playing' ||
    after.held === 0
  )
    return null;
  const travel = (config.paddleSpeed * (after.at - before.at)) / 1000;
  const margin = config.paddleHeight / 2 + travel * 2;
  const from = before.state.paddles[after.own].y;
  const to = after.state.paddles[after.own].y;
  if (Math.min(from, to) < margin || Math.max(from, to) > config.height - margin)
    return null;
  const step = Math.abs(to - from);
  if (step > travel) return (step - travel) / travel;
  return before.held === after.held ? (travel - step) / travel : 0;
}

const sameRally = (a: PongState, b: PongState) =>
  a.phase === 'playing' &&
  b.phase === 'playing' &&
  a.feedback.points === b.feedback.points &&
  a.feedback.paddles === b.feedback.paddles &&
  a.feedback.walls === b.feedback.walls &&
  a.feedback.serves === b.feedback.serves;

/** One judged moment: when the display showed it, and its value. */
export type FrameEvidence = { readonly atMs: number; readonly value: number };

/** Everything a display showed, one judged value per moment, for objectives. */
export type PongFrameEvidence = {
  readonly ballPace: readonly FrameEvidence[];
  readonly bounceContact: readonly FrameEvidence[];
  readonly paddleResponseMs: readonly FrameEvidence[];
  readonly paddlePace: readonly FrameEvidence[];
  readonly courtAgeMs: readonly FrameEvidence[];
};

export function frameEvidence(input: {
  readonly samples: readonly FrameSample[];
  readonly received: readonly { readonly tick: number; readonly at: number }[];
  readonly tickRate: number;
  readonly responses: readonly FrameEvidence[];
}): PongFrameEvidence {
  const ballPace: FrameEvidence[] = [];
  const bounceContact: FrameEvidence[] = [];
  const paddlePace: FrameEvidence[] = [];
  for (let index = 1; index < input.samples.length; index++) {
    const before = input.samples[index - 1]!;
    const after = input.samples[index]!;
    if (before.state === null || after.state === null) continue;
    const own = ownStep(before, after);
    if (own !== null) paddlePace.push({ atMs: after.at, value: own });
    const gap = contactGap(before.state, after.state, after.at - before.at);
    if (gap !== null) bounceContact.push({ atMs: after.at, value: gap });
    if (!sameRally(before.state, after.state)) continue;
    const speed = Math.hypot(after.state.ball.vx, after.state.ball.vy);
    if (speed === 0) continue;
    const expected = (speed * (after.at - before.at)) / 1000;
    const moved = Math.hypot(
      after.state.ball.x - before.state.ball.x,
      after.state.ball.y - before.state.ball.y
    );
    ballPace.push({ atMs: after.at, value: Math.abs(moved - expected) / expected });
  }
  const interval = 1000 / input.tickRate;
  // The authority's clock, seen from the device: its least delayed court.
  let offset = Number.POSITIVE_INFINITY;
  for (const court of input.received)
    offset = Math.min(offset, court.at - court.tick * interval);
  const courtAgeMs = input.samples.flatMap((sample) =>
    sample.tick === null
      ? []
      : [{ atMs: sample.at, value: sample.at - (offset + sample.tick * interval) }]
  );
  return {
    ballPace,
    bounceContact,
    paddleResponseMs: input.responses,
    paddlePace,
    courtAgeMs,
  };
}

export function summarizeFrames(input: {
  readonly evidence: PongFrameEvidence;
  readonly received: readonly { readonly tick: number; readonly at: number }[];
  readonly errors: number;
}): PongFrameReport {
  const values = (list: readonly FrameEvidence[]) => list.map((one) => one.value);
  const share = (list: readonly FrameEvidence[], bad: (value: number) => boolean) =>
    list.length === 0 ? 0 : list.filter((one) => bad(one.value)).length / list.length;
  const { ballPace, bounceContact, paddlePace } = input.evidence;
  const arrivals: number[] = [];
  for (let index = 1; index < input.received.length; index++)
    arrivals.push(input.received[index]!.at - input.received[index - 1]!.at);
  return {
    motionFrames: ballPace.length,
    frozenRatio: share(ballPace, (value) => value >= 0.95),
    snapRatio: share(ballPace, (value) => value > 0.5),
    stepError: percentiles(values(ballPace)),
    ownFrames: paddlePace.length,
    ownSnapRatio: share(paddlePace, (value) => value > 0.5),
    bounces: bounceContact.length,
    missedContactRatio: share(bounceContact, (value) => value > 1),
    contactGap: percentiles(values(bounceContact)),
    stateAgeMs: percentiles(values(input.evidence.courtAgeMs)),
    inputLatencyMs: percentiles(values(input.evidence.paddleResponseMs)),
    arrivalIntervalMs: percentiles(arrivals),
    errors: input.errors,
    evidence: input.evidence,
  };
}
