import { pongConfig } from '@libs/pong-shared-ts/pong-config';
import { pongPositionCodec } from '@libs/pong-shared-ts/pong-game';
import {
  initialPongState,
  type PongInput,
  parsePongInput,
} from '@libs/pong-shared-ts/pong-state';
import { createPongStep } from '@libs/pong-shared-ts/pong-step';
import type { GameSimulationControls } from '@pkgs/turn-game-shared-ts/game-presentation';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from '@solidjs/web';
import { createSignal } from 'solid-js';

/** Story-only transport and virtual ticks; all motion and scoring use product mechanics. */
export function PongJourney(props: {
  children: (
    position: () => string,
    controls: GameSimulationControls
  ) => JSX.Element;
}): JSX.Element {
  const config = pongConfig({ targetScore: 3 });
  const step = createPongStep(config);
  // The court as last stepped: several ticks in one press each step from
  // this, never from a signal read back before it has settled.
  let court = {
    ...initialPongState(config, () => 0),
    phase: 'playing' as const,
    countdown: 0,
    ball: { x: 90, y: 360, vx: -480, vy: 0 },
  } as ReturnType<typeof initialPongState>;
  const [state, setState] = createSignal(court);
  const [stale, setStale] = createSignal(false);
  let tick = 0;
  const advance = (input?: PongInput) => {
    if (stale()) return;
    tick += 1;
    court = step(
      court,
      input ? [{ tick, sequence: tick, playerId: 'left', value: input }] : [],
      {
        tick,
        deltaMs: 1000 / config.tickRate,
        elapsedMs: (tick * 1000) / config.tickRate,
        random: () => 0,
      }
    );
    setState(court);
  };
  const controls: GameSimulationControls = {
    sides: ['white'],
    paused: false,
    get stale() {
      return stale();
    },
    onInput: (_side, value) => {
      const input = parsePongInput(value);
      if (!input) throw new Error('Invalid Pong input');
      advance(input);
    },
    onRelease: () => advance({ kind: 'direction', direction: 0 }),
  };
  return (
    <StackVertical gap="md">
      {props.children(() => pongPositionCodec.encode(state()), controls)}
      <Text testId="pong-journey-returns">
        {state().feedback.paddles} returns
      </Text>
      <Text testId="pong-journey-points">{state().feedback.points} points</Text>
      <Button
        onClick={() => {
          for (let i = 0; i < 180; i++) advance();
        }}
        title="Advance three seconds"
      />
      <Button
        onClick={() => setStale(!stale())}
        title={stale() ? 'Restore connection' : 'Disconnect'}
      />
    </StackVertical>
  );
}
