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
        // #region agent log
        fetch('http://127.0.0.1:7361/ingest/941b0c72-7feb-4dff-9211-7ec92eb2cf5b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dffa91'},body:JSON.stringify({sessionId:'dffa91',location:'simulated-client-transport.ts:read',message:'remote_read emitted',data:{clientId,resultSummaries:summarizeResults(results),entityDetails:results.map(r=>r.entities.map(e=>({entityId:e.entityId,entityType:e.entityType,attrKeys:Object.keys(e.attributes||{})})))},timestamp:Date.now(),hypothesisId:'H-A'})}).catch(()=>{});
        // #endregion
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

  write(patches: PatchInput[]): Promise<Patch[]> {
    return this.link.invoke('write', async () => {
      const out = await this.server.write(patches);
      if (this.recording) {
        const { recorder, clientId, getTime } = this.recording;
        const writeSummaries = summarizePatchInputs(patches);
        // #region agent log
        fetch('http://127.0.0.1:7361/ingest/941b0c72-7feb-4dff-9211-7ec92eb2cf5b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dffa91'},body:JSON.stringify({sessionId:'dffa91',location:'simulated-client-transport.ts:write',message:'remote_write summaries after filter',data:{clientId,summaries:writeSummaries.map(s=>({entityId:s.entityId,attrKeys:s.attributeKeys})),rawAttrKeys:patches.map(p=>Object.keys(p.attributes??{}))},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
        recorder.emit({
          type: 'remote_write',
          clientId,
          summaries: writeSummaries,
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
