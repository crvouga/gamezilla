import { createMessageNamespace } from '@pkgs/message-shared-ts/message';
import type { RoomActor } from '@pkgs/room-root-shared-ts/types';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { z } from 'zod';

const ns = createMessageNamespace('game-simulation');
const claimSchema = z.object({ version: z.literal(1) }).strict();
const steeringSchema = z
  .object({
    version: z.literal(1),
    /** Each seat a person controls, with the one device (client) steering it. */
    steering: z.record(z.string().min(1).max(256), z.string().min(1).max(256)),
  })
  .strict();

/** A person's device asks to steer their seats from now on. */
export const ClaimSimulationControl = ns<z.infer<typeof claimSchema>>(
  'claim',
  (value): value is z.infer<typeof claimSchema> =>
    claimSchema.safeParse(value).success
);
/** Which device steers each seat a person controls. */
export const SimulationSteeringChanged = ns<z.infer<typeof steeringSchema>>(
  'steering',
  (value): value is z.infer<typeof steeringSchema> =>
    steeringSchema.safeParse(value).success
);

/**
 * One device steers a person's seats at a time: the first of their devices
 * present, until another of their devices claims it. A device that leaves
 * hands steering to the person's next device still present.
 */
export class SimulationSteering {
  private readonly steering = new Map<string, string>();
  private actors: readonly RoomActor[] = [];

  /** Presence changed; returns whether any person's steering device changed. */
  presence(actors: readonly RoomActor[], people: readonly string[]): boolean {
    this.actors = actors;
    let changed = false;
    for (const person of new Set([...this.steering.keys(), ...people])) {
      const devices = actors
        .filter((actor) => actor.id === person)
        .map((actor) => actor.clientId);
      const current = this.steering.get(person);
      if (
        current !== undefined &&
        devices.includes(current) &&
        people.includes(person)
      )
        continue;
      const next = people.includes(person) ? devices[0] : undefined;
      if (next === current) continue;
      if (next === undefined) this.steering.delete(person);
      else this.steering.set(person, next);
      changed = true;
    }
    return changed;
  }

  /** `actor`'s device steers their seats from now; returns whether that changed. */
  claim(actor: RoomActor, people: readonly string[]): boolean {
    if (
      !people.includes(actor.id) ||
      !this.actors.some(
        (present) =>
          present.id === actor.id && present.clientId === actor.clientId
      ) ||
      this.steering.get(actor.id) === actor.clientId
    )
      return false;
    this.steering.set(actor.id, actor.clientId);
    return true;
  }

  /** Whether `actor`'s device is the one that steers their seats. */
  steers(actor: RoomActor): boolean {
    const device = this.steering.get(actor.id);
    return device === undefined || device === actor.clientId;
  }

  /** The device steering each controlled seat. */
  bySide(controllers: ReadonlyMap<GameSide, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [side, person] of controllers) {
      const device = this.steering.get(person);
      if (device !== undefined) out[side] = device;
    }
    return out;
  }
}
