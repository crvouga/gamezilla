import type { Unsubscribe } from '../../../pub-sub/interface';
import type {
  Patch,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
} from '../../interface';
import type { PatchDbClientTransport } from '../../transport/interface';
import type { SimEventRecorder } from './event-recorder';
import {
  summarizePatchInputs,
  summarizeQueries,
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
 * Deterministic counterpart to HTTP+SSE: read/write go through a {@link NetworkLink};
 * invalidations are scheduled on the same scheduler as the link.
 */
export class SimulatedPatchDbClientTransport implements PatchDbClientTransport {
  constructor(
    private readonly server: SimServerPort,
    private readonly link: NetworkLink,
    private readonly recording?: SimulatedTransportRecordingContext
  ) {}

  read(queries: PatchesDbQuery[]): Promise<PatchesDbResult[]> {
    return this.link.invoke('read', async () => {
      const results = await this.server.read(queries);
      if (this.recording) {
        const { recorder, clientId, getTime } = this.recording;
        recorder.emit({
          type: 'remote_read',
          clientId,
          queries: summarizeQueries(queries),
          results: summarizeResults(results),
          time: getTime(),
        });
      }
      return results;
    });
  }

  write(patches: PatchInput[]): Promise<Patch[]> {
    return this.link.invoke('write', async () => {
      const out = await this.server.write(patches);
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

  subscribe(callback: () => void): Unsubscribe {
    return this.server.subscribeInvalidations(() => {
      if (this.link.blocksInvalidations()) return;
      this.link.scheduleInvalidation(() => callback());
    });
  }
}
