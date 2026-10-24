import type { Message } from '@pkgs/message-shared-ts/message';
import type { SimulationExecution } from '@pkgs/turn-game-shared-ts/simulation-execution';
import { SimulationStateChanged } from './simulation-messages';
import {
  RecoverSimulation,
  type SimulationRecovery,
  simulationRecoverySource,
} from './simulation-recovery';
import type {
  SimulationSessionBinding,
  SimulationSessionView,
} from './simulation-session-runtime';

/** Only a successfully stored frame may be observed outside a persistent authority. */
export function publishRecoverableSimulation(args: {
  readonly message: Message;
  readonly view: SimulationSessionView;
  readonly execution: SimulationExecution;
  readonly phase: SimulationExecution['phase'];
  readonly persist: SimulationSessionBinding['persist'];
  readonly publish: (recovery: SimulationRecovery | null) => void;
  readonly onError: (error: unknown) => void;
}): void {
  if (args.persist === undefined) {
    args.publish(null);
    return;
  }
  if (!SimulationStateChanged.is(args.message)) return;
  const snapshot = args.message.payload;
  const execution = {
    ...args.execution,
    phase: args.phase,
    started: args.execution.started || args.phase === 'running',
    tick: snapshot.tick,
    acknowledged: snapshot.acknowledged,
  };
  const checkpoint = RecoverSimulation({
    source: simulationRecoverySource(args.view),
    checkpoint: {
      gameId: args.view.id,
      position: snapshot.state,
      execution,
      previousEpoch: execution.epoch,
    },
  });
  args.persist(checkpoint).then((saved) => {
    if (saved) args.publish(checkpoint.payload);
  }, args.onError);
}
