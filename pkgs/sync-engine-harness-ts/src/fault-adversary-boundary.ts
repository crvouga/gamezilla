import type { SeededRng } from '@pkgs/uuid-shared-ts/seeded-rng';
import { CORRUPTION_VARIANTS } from './catalog';
import type { FaultMove } from './fault-adversary';
import type { BoundaryFault } from './fault-profiles';
import { VERDICT_CORRUPTIONS } from './hostile-responses';

type Route = 'mutations' | 'query';

const LIVE_CUT_MAX_MS = 20_000;

function http(
  clientId: string,
  fault: Extract<FaultMove, { kind: 'http' }>['fault']
): FaultMove {
  return { kind: 'http', clientId, fault };
}

/** One boundary fault → a concrete move with seeded parameters. */
export function toBoundaryMove(
  kind: BoundaryFault,
  rng: SeededRng,
  clientId: string
): FaultMove {
  const route: Route = rng.bool(0.5) ? 'mutations' : 'query';
  switch (kind) {
    case 'serverError':
      return http(clientId, { kind: 'serverErrorOnNext', route });
    case 'rateLimited':
      return http(clientId, {
        kind: 'rateLimited',
        route,
        retryAfterMs: 500 + rng.int(5_000),
      });
    case 'unauthorized':
      return http(clientId, { kind: 'authExpiredInFlight', route });
    case 'forbidden':
      return http(clientId, { kind: 'forbidden', route });
    case 'captivePortal':
      return http(clientId, { kind: 'captivePortal', route });
    case 'requestLost':
      return http(clientId, { kind: 'dropRequest', route });
    case 'responseLost':
      return http(
        clientId,
        route === 'mutations'
          ? { kind: 'dropMutationsResponse' }
          : { kind: 'dropQueryResponse' }
      );
    case 'failedAfterCommit':
      return http(clientId, { kind: 'failMutationsAfterCommit' });
    case 'truncatedBody':
      return rng.bool(0.5)
        ? http(clientId, { kind: 'abortResponseBody', route })
        : http(
            clientId,
            route === 'mutations'
              ? { kind: 'corruptMutationsResponse', variant: 'truncatedJson' }
              : { kind: 'corruptQueryResponse', variant: 'truncatedJson' }
          );
    case 'malformedBody': {
      const variant = rng.pick(CORRUPTION_VARIANTS);
      return http(
        clientId,
        route === 'mutations'
          ? { kind: 'corruptMutationsResponse', variant }
          : { kind: 'corruptQueryResponse', variant }
      );
    }
    case 'malformedVerdicts':
      return http(clientId, {
        kind: 'corruptVerdicts',
        variant: rng.pick(VERDICT_CORRUPTIONS),
      });
    case 'pushDropped':
      return { kind: 'pushDropped' };
    case 'pushCorrupt':
      return {
        kind: 'pubsub',
        fault: {
          kind: 'corruptPubsubPayload',
          variant: rng.pick(CORRUPTION_VARIANTS),
        },
      };
    case 'pushDuplicated':
      return { kind: 'pubsub', fault: { kind: 'duplicatePublish', count: 1 } };
    case 'liveDisconnect':
      return { kind: 'liveCut', clientId, ms: 1 + rng.int(LIVE_CUT_MAX_MS) };
    default: {
      const exhaustive: never = kind;
      throw new Error(`unknown boundary fault ${String(exhaustive)}`);
    }
  }
}
