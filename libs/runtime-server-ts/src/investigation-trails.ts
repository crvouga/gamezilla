import type { Clock } from '@pkgs/clock-shared-ts/types';
import { readUtf8, writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';

/** What a follow or a person's look returns. People are always refused. */
export type TrailReading =
  | { readonly kind: 'read'; readonly observations: unknown }
  | { readonly kind: 'expired' }
  | { readonly kind: 'nothing' }
  | { readonly kind: 'refused' };

/** Ordinary investigation evidence has an absolute 30-day lifetime. */
export class InvestigationTrails {
  constructor(
    private readonly ports: {
      readonly clock: Clock;
      readonly objectStore: ObjectStore;
    }
  ) {}
  async record(id: string, observations: unknown): Promise<void> {
    await writeUtf8(
      this.ports.objectStore,
      `investigation/${id}.json`,
      JSON.stringify({ recordedAt: this.ports.clock.now(), observations }),
      'application/json'
    );
  }
  async follow(id: string): Promise<TrailReading> {
    const key = `investigation/${id}.json`;
    const text = await readUtf8(this.ports.objectStore, key);
    if (text === null) return { kind: 'nothing' };
    const trail = JSON.parse(text) as {
      recordedAt: number;
      observations: unknown;
    };
    if (this.ports.clock.now() - trail.recordedAt >= 30 * 86_400_000) {
      await this.ports.objectStore.delete(key);
      return { kind: 'expired' };
    }
    return { kind: 'read', observations: trail.observations };
  }

  /** A person is never shown what the team would read. */
  async lookAsPerson(id: string): Promise<TrailReading> {
    await this.follow(id);
    return { kind: 'refused' };
  }
  async preservationObligation(id: string): Promise<unknown | null> {
    const text = await readUtf8(
      this.ports.objectStore,
      `preserved-investigation/${id}.json`
    );
    return text === null ? null : JSON.parse(text);
  }
  async expire(): Promise<void> {
    for (const key of await this.ports.objectStore.listKeys('investigation/'))
      await this.follow(key.slice('investigation/'.length, -'.json'.length));
  }
}
