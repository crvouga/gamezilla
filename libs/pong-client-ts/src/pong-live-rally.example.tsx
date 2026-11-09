// @io-wall-ok — story-only real-time driver; frame time is read only here.
import { pongConfig } from '@libs/pong-shared-ts/pong-config';
import { pongPositionCodec } from '@libs/pong-shared-ts/pong-game';
import {
  initialPongState,
  type PongInput,
  type PongState,
  parsePongInput,
} from '@libs/pong-shared-ts/pong-state';
import { createPongStep } from '@libs/pong-shared-ts/pong-step';
import type { GameSimulationControls } from '@pkgs/turn-game-shared-ts/game-presentation';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { createSignal, type JSX, onCleanup } from 'solid-js';

/**
 * A rally played in real time by the product's own fixed-step mechanics: the
 * court holds still at a fixed mid-rally position until the first paddle
 * input, so its first frame is the same on every run, then the ball and
 * paddles advance at the game's tick rate until the match ends.
 */
export function PongLiveRally(props: {
  sides: readonly GameSide[];
  children: (
    position: () => string,
    controls: GameSimulationControls
  ) => JSX.Element;
}): JSX.Element {
  const config = pongConfig({ targetScore: 11 });
  const step = createPongStep(config);
  const tickMs = 1000 / config.tickRate;
  // A served ball crossing toward the right paddle, mid-court.
  const [state, setState] = createSignal<PongState>({
    ...initialPongState(config, () => 0),
    phase: 'playing',
    countdown: 0,
    ball: {
      x: config.width / 2,
      y: config.height / 3,
      vx: config.ballSpeed * 0.8,
      vy: config.ballSpeed * 0.6,
    },
    feedback: { walls: 0, paddles: 0, points: 0, serves: 1 },
  });
  const pending: { side: GameSide; value: PongInput }[] = [];
  let tick = 0;
  let frame: number | undefined;
  let last = 0;
  let owed = 0;
  const advance = (from: PongState): PongState => {
    tick += 1;
    const inputs = pending.splice(0).map((input, index) => ({
      tick,
      sequence: tick * 4 + index,
      playerId: input.side === 'white' ? 'left' : 'right',
      value: input.value,
    }));
    return step(from, inputs, {
      tick,
      deltaMs: tickMs,
      elapsedMs: tick * tickMs,
      random: () => 0.3,
    });
  };
  const run = (now: number) => {
    owed += Math.min(now - last, 250);
    last = now;
    // Every tick owed since the last frame, then one paint: the court is
    // drawn once per frame, as a player's screen shows it.
    let next = state();
    while (owed >= tickMs && next.phase !== 'completed') {
      owed -= tickMs;
      next = advance(next);
    }
    if (next !== state()) setState(next);
    frame = next.phase === 'completed' ? undefined : requestAnimationFrame(run);
  };
  const start = () => {
    if (frame !== undefined) return;
    last = performance.now();
    frame = requestAnimationFrame(run);
  };
  onCleanup(() => {
    if (frame !== undefined) cancelAnimationFrame(frame);
  });
  const controls: GameSimulationControls = {
    sides: props.sides,
    paused: false,
    stale: false,
    onInput: (side, value) => {
      const input = parsePongInput(value);
      if (!input) throw new Error('Invalid Pong input');
      pending.push({ side, value: input });
      start();
    },
    onRelease: () => undefined,
  };
  return (
    <>{props.children(() => pongPositionCodec.encode(state()), controls)}</>
  );
}
