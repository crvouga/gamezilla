import type { Unsubscribe } from '../../../pub-sub/interface';
import type {
  Patch,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
} from '../../interface';
import type { PatchDbClientTransport } from '../../transport/interface';
import type { NetworkLink } from './network-link';
import type { SimServerPort } from './server-port';

/**
 * Deterministic counterpart to HTTP+SSE: read/write go through a {@link NetworkLink};
 * invalidations are scheduled on the same scheduler as the link.
 */
export class SimulatedPatchDbClientTransport implements PatchDbClientTransport {
  constructor(
    private readonly server: SimServerPort,
    private readonly link: NetworkLink
  ) {}

  read(queries: PatchesDbQuery[]): Promise<PatchesDbResult[]> {
    return this.link.invoke('read', () => this.server.read(queries));
  }

  write(patches: PatchInput[]): Promise<Patch[]> {
    return this.link.invoke('write', () => this.server.write(patches));
  }

  subscribe(callback: () => void): Unsubscribe {
    return this.server.subscribeInvalidations(() => {
      if (this.link.blocksInvalidations()) return;
      this.link.scheduleInvalidation(() => callback());
    });
  }
}
