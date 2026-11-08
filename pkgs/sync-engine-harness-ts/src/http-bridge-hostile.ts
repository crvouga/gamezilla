import type { EndpointId } from '@pkgs/harness-root-shared-ts/network-state';
import type { EdgeFaultController, HarnessHttpFault } from './edge-faults';
import { CAPTIVE_PORTAL_HTML } from './hostile-responses';
import type { HarnessHttpResponse } from './http-bridge-types';
import type { SyncNetwork } from './network';

type Route = 'mutations' | 'query';

type HostileArgs = {
  readonly route: Route;
  readonly replyTo: EndpointId;
  readonly correlationId: string;
  readonly serverId: EndpointId;
  readonly network: SyncNetwork;
  readonly faults: EdgeFaultController | undefined;
  readonly clientNode: string | undefined;
};

const HOSTILE_KINDS = ['dropRequest', 'captivePortal', 'forbidden'] as const;

function takeHostile(args: HostileArgs): HarnessHttpFault | undefined {
  if (args.clientNode === undefined || args.faults === undefined) {
    return undefined;
  }
  for (const kind of HOSTILE_KINDS) {
    const fault = args.faults.peekHttpFault(args.clientNode, kind);
    if (fault === undefined) continue;
    if ('route' in fault && fault.route !== args.route) continue;
    return args.faults.takeHttpFault(args.clientNode, kind);
  }
  return undefined;
}

/**
 * Answer in place of the server when a hostile-network fault is armed for
 * this route: the request is lost, a captive portal answers 200 with a
 * sign-in page, or a proxy refuses with 403. Returns `'done'` when the
 * server must not see the request.
 */
export function applyHostileNetworkFaults(
  args: HostileArgs
): 'continue' | 'done' {
  const fault = takeHostile(args);
  if (fault === undefined) return 'continue';
  if (fault.kind === 'dropRequest') return 'done';
  const reply: HarnessHttpResponse =
    fault.kind === 'captivePortal'
      ? ({
          kind: args.route,
          correlationId: args.correlationId,
          ok: true,
          body: CAPTIVE_PORTAL_HTML,
        } as unknown as HarnessHttpResponse)
      : {
          kind: 'error',
          correlationId: args.correlationId,
          ok: false,
          message: `/api/${args.route} failed (403): Forbidden`,
        };
  args.network.send(args.serverId, args.replyTo, reply);
  return 'done';
}
