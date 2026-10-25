/** Logical court units, independent of viewport pixels and display frequency. */
export const PONG_CONFIG = Object.freeze({
  tickRate: 60,
  snapshotRate: 20,
  width: 1200,
  height: 800,
  paddleInset: 64,
  paddleWidth: 18,
  paddleHeight: 144,
  paddleSpeed: 600,
  ballRadius: 10,
  ballSpeed: 480,
  maxBallSpeed: 1080,
  hitAcceleration: 36,
  maxBounceSlope: 1.2,
  countdownTicks: 180,
  serveTicks: 60,
  inputLeaseTicks: 18,
  maxCollisionsPerTick: 8,
  maxCatchUpTicks: 8,
  maxQueuedInputs: 256,
  maxInputLeadTicks: 30,
  targetScore: 11,
});

export type PongConfig = { readonly [K in keyof typeof PONG_CONFIG]: number };

export function pongConfig(
  options: Partial<
    Pick<PongConfig, 'targetScore' | 'tickRate' | 'snapshotRate'>
  > = {}
): PongConfig {
  const targetScore = options.targetScore ?? PONG_CONFIG.targetScore;
  const tickRate = options.tickRate ?? PONG_CONFIG.tickRate;
  const snapshotRate = options.snapshotRate ?? PONG_CONFIG.snapshotRate;
  if (!Number.isSafeInteger(targetScore) || targetScore < 1 || targetScore > 99)
    throw new Error('Pong score target must be an integer from 1 to 99');
  if (!Number.isSafeInteger(tickRate) || tickRate < 30 || tickRate > 240)
    throw new Error('Pong tick rate must be an integer from 30 to 240');
  if (
    !Number.isSafeInteger(snapshotRate) ||
    snapshotRate < 1 ||
    snapshotRate > tickRate
  )
    throw new Error(
      'Pong snapshot rate must be an integer from 1 to the tick rate'
    );
  return Object.freeze({
    ...PONG_CONFIG,
    targetScore,
    tickRate,
    snapshotRate,
    countdownTicks: tickRate * 3,
    serveTicks: tickRate,
    inputLeaseTicks: Math.ceil(tickRate * 0.3),
    maxInputLeadTicks: Math.ceil(tickRate * 0.5),
  });
}
