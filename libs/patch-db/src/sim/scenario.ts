import { buildScenario } from './build-scenario';
import { type SimRecordingMeta } from './event-recorder';
import type { Sim } from './sim';
import type {
  ScenarioClientSpec,
  ScenarioServerSpec,
} from './sim-types';

export { Sim } from './sim';
export type {
  ScenarioClientSpec,
  ScenarioServerSpec,
  SimClient,
  SimLink,
  SimServer,
} from './sim-types';
export type { SimRecordingMeta };

function hasAnyMetaField(meta: Partial<SimRecordingMeta>): boolean {
  return (
    meta.title !== undefined ||
    meta.description !== undefined ||
    meta.intent !== undefined ||
    meta.tags !== undefined ||
    meta.source !== undefined
  );
}

export class PatchDbScenarioBuilder {
  private readonly servers: ScenarioServerSpec[] = [];
  private readonly clients: ScenarioClientSpec[] = [];
  private recordingMeta: Partial<SimRecordingMeta> = {};

  /** Defaults merged before any per-test {@link Sim.setMeta} calls. */
  meta(partial: Partial<SimRecordingMeta>): this {
    if (partial.title !== undefined) {
      this.recordingMeta.title = partial.title;
    }
    if (partial.description !== undefined) {
      this.recordingMeta.description = partial.description;
    }
    if (partial.intent !== undefined) {
      this.recordingMeta.intent = partial.intent;
    }
    if (partial.tags !== undefined) {
      this.recordingMeta.tags = partial.tags;
    }
    if (partial.source !== undefined) {
      this.recordingMeta.source = {
        ...this.recordingMeta.source,
        ...partial.source,
      };
    }
    return this;
  }

  server(id: string): this {
    this.servers.push({ id });
    return this;
  }

  client(id: string, options: { server: string }): this {
    this.clients.push({ id, serverId: options.server });
    return this;
  }

  async build(): Promise<Sim> {
    const hasMeta = hasAnyMetaField(this.recordingMeta);
    return buildScenario(
      this.servers,
      this.clients,
      hasMeta ? this.recordingMeta : undefined
    );
  }
}
