import { databaseUrlFor } from '@pkgs/postgres-local-shared/ports';
import type { ServiceContext } from './dev-services';
import type { StackManifest } from './manifest';
import type { StackPlan } from './stack-plan';
import { SERVICE_NAMES, type StackServices } from './stack-services';

export type DevelopmentServices = {
  readonly [K in keyof StackServices]: StackServices[K] | null;
};

/** Read each service's published startup result. */
export async function readDevelopmentServices(
  need: ServiceContext['need'],
  unavailable: (name: keyof StackServices, error: unknown) => void
): Promise<DevelopmentServices> {
  const entries = await Promise.all(
    SERVICE_NAMES.map(async (name) => {
      try {
        return [name, await need(name)] as const;
      } catch (error) {
        unavailable(name, error);
        return [name, null] as const;
      }
    })
  );
  return Object.fromEntries(entries) as DevelopmentServices;
}

/** Addresses remain useful for reconnection and diagnostics when a service is down. */
export function developmentManifest(
  plan: StackPlan,
  services: DevelopmentServices,
  startedAtMs: number
): StackManifest {
  const loopback = (port: number): string => `http://127.0.0.1:${String(port)}`;
  return {
    instanceId: plan.options.instanceId,
    startedAtMs,
    apiOrigin: services.server?.apiOrigin ?? plan.apiOrigin,
    apiNodes: services.server?.nodes ?? [],
    webOrigin: services.web?.origin ?? '',
    idpOrigins: {
      google: services.idp?.google ?? loopback(plan.ports.google),
      apple: services.idp?.apple ?? loopback(plan.ports.apple),
    },
    billingOrigin: services.billing?.origin ?? loopback(plan.ports.billing),
    databaseUrl:
      services.postgres?.databaseUrl ?? databaseUrlFor(plan.ports.postgres),
    s3Endpoint: services.s3?.endpoint ?? null,
    mqttWssUrl: services.mqtt?.wssUrl ?? null,
    mqttUrl: services.mqtt?.mqttUrl ?? null,
    observabilityCollectorUrl: services.observability?.collectorUrl ?? null,
    observabilityTraceDir: services.observability?.traceDir ?? null,
    observabilityTempoUrl: services.observability?.tempoUrl ?? null,
    observabilityGrafanaUrl: services.observability?.grafanaUrl ?? null,
    dataDir: plan.dataDir,
  };
}
