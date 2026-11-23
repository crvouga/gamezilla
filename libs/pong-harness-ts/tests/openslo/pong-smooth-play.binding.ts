/**
 * `specs/pong/pong-smooth-play.openslo.yaml`: Pong played through the
 * production replica, presentation and room on virtual time, on each
 * device profile and seed, judged frame by frame as a 60 Hz display shows
 * it (`pong-frame-probe`).
 */

import {
  measurePongFrames,
  pongFrameSystem,
} from '@libs/pong-harness-ts/pong-frame-probe';
import {
  PONG_FRAME_PROFILES,
  PONG_FRAME_SEEDS,
} from '@libs/pong-harness-ts/pong-frame-profiles';
import type { PongFrameEvidence } from '@libs/pong-harness-ts/pong-frame-report';
import type { Measurement } from '@pkgs/openslo-shared-ts/evaluate';
import { bindObjectives } from '@pkgs/openslo-shared-ts/registry';

let played: Promise<readonly PongFrameEvidence[]> | undefined;

/** Every profile and seed, played once and shared by every indicator. */
function play(): Promise<readonly PongFrameEvidence[]> {
  played ??= (async () => {
    const evidence: PongFrameEvidence[] = [];
    for (const args of Object.values(PONG_FRAME_PROFILES))
      for (const seed of PONG_FRAME_SEEDS) {
        await using run = await pongFrameSystem.run({ seed, args });
        const report = await run.read(measurePongFrames);
        if (report.errors > 0)
          throw new Error(`Pong presentation failed ${report.errors} times`);
        evidence.push(report.evidence);
      }
    return evidence;
  })();
  return played;
}

function measure(
  pick: (evidence: PongFrameEvidence) => PongFrameEvidence['ballPace'],
  scale = 1
) {
  return async (): Promise<Measurement> => ({
    kind: 'samples',
    samples: (await play())
      .flatMap(pick)
      .map((one) => ({ atMs: one.atMs, value: one.value * scale })),
  });
}

/** The probes judge in milliseconds; the objectives say seconds. */
const SECONDS = 1 / 1000;

bindObjectives({
  spec: 'pong-smooth-play',
  timeoutMs: 120_000,
  measure: {
    'pong-ball-pace': measure((evidence) => evidence.ballPace),
    'pong-bounce-contact': measure((evidence) => evidence.bounceContact),
    'pong-paddle-response-time': measure(
      (evidence) => evidence.paddleResponseMs,
      SECONDS
    ),
    'pong-paddle-pace': measure((evidence) => evidence.paddlePace),
    'pong-court-age': measure((evidence) => evidence.courtAgeMs, SECONDS),
  },
});
