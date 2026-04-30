import type {
  Patch,
  PatchesDbContext,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
} from '../interface';
import type { PatchDbClientTransport } from '../transport/interface';
import type { SimEventRecorder } from './event-recorder';
import {
  summarizePatchInputs,
  summarizeQueries,
  summarizeResultEntities,
  summarizeResults,
} from './event-recorder';
import type { NetworkLink } from './network-link';
import type { SimServerPort } from './server-port';

export type SimulatedTransportRecordingContext = {
  recorder: SimEventRecorder;
  clientId: string;
  getTime: () => number;
};

/**
 * Deterministic counterpart to HTTP: read/write go through a {@link NetworkLink}.
 */
export class SimulatedPatchDbClientTransport implements PatchDbClientTransport {
  constructor(
    private readonly server: SimServerPort,
    private readonly link: NetworkLink,
    private readonly recording?: SimulatedTransportRecordingContext
  ) {}

  read(
    queries: PatchesDbQuery[],
    ctx?: PatchesDbContext
  ): Promise<PatchesDbResult[]> {
    return this.link.invoke('read', async () => {
      const results = await this.server.read(queries, ctx);
      if (this.recording) {
        const { recorder, clientId, getTime } = this.recording;
        recorder.emit({
          type: 'remote_read',
          clientId,
          queries: summarizeQueries(queries),
          results: summarizeResults(results),
          summaries: summarizeResultEntities(results),
          time: getTime(),
        });
      }
      return results;
    });
  }

  write(
    patches: PatchInput[],
    ctx?: PatchesDbContext
  ): Promise<Patch[]> {
    return this.link.invoke('write', async () => {
      const out = await this.server.write(patches, ctx);
      if (this.recording) {
        const { recorder, clientId, getTime } = this.recording;
        recorder.emit({
          type: 'remote_write',
          clientId,
          summaries: summarizePatchInputs(patches),
          returnedPatchCount: out.length,
          time: getTime(),
        });
      }
      return out;
    });
  }
}
