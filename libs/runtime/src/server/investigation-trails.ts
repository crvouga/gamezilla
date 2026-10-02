import type { Clock } from '@pkgs/clock';
import { readUtf8, writeUtf8 } from '@pkgs/object-store/helpers';
import type { ObjectStore } from '@pkgs/object-store/interface';

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
  async follow(id: string): Promise<unknown | null> {
    const key = `investigation/${id}.json`;
    const text = await readUtf8(this.ports.objectStore, key);
    if (text === null) return null;
    const trail = JSON.parse(text) as {
      recordedAt: number;
      observations: unknown;
    };
    if (this.ports.clock.now() - trail.recordedAt >= 30 * 86_400_000) {
      await this.ports.objectStore.delete(key);
      return null;
    }
    return trail.observations;
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
