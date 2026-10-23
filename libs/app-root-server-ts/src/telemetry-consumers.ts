import type { ServerEnv } from '@libs/app-root-shared-ts/server-env';
import type { ComposedSubServers } from '@libs/sub-shared-ts/compose-server';

export function registerTelemetryConsumers(
  servers: ComposedSubServers,
  env: ServerEnv
): void {
  const deliver = env.deliverBusinessEvent;
  if (deliver === undefined) return;
  for (const event of servers.telemetryEvents ?? []) {
    const id = `telemetry:${event.contract.name}:v${event.contract.version}`;
    if (servers.outboxConsumers.get(id) !== undefined) continue;
    servers.outboxConsumers.register({
      id,
      on: event.outbox.message,
      handler: (ctx, payload) =>
        deliver({
          contract: event.contract,
          event: payload,
          observedAtMs: ctx.clock.now(),
        }),
    });
  }
}
