import { type RailwayCustomDomain, railwayGql } from './railway-api-core';
import {
  CustomDomainCreateMutation,
  DomainsQuery,
  ServiceDeleteMutation,
  ServiceDomainCreateMutation,
  ServiceInstanceDeployV2Mutation,
  ServiceInstanceRedeployMutation,
  VolumeCreateMutation,
} from './railway-graphql/documents';
import type { ResultOf } from './railway-graphql/graphql';

type CustomDomainNode = NonNullable<
  ResultOf<typeof DomainsQuery>['domains']['customDomains'][number]
>;

export async function ensureCustomDomain(options: {
  readonly token: string;
  readonly projectId: string;
  readonly serviceId: string;
  readonly environmentId: string;
  readonly domain: string;
  readonly targetPort: number;
}): Promise<RailwayCustomDomain> {
  const listed = await railwayGql(options.token, DomainsQuery, {
    environmentId: options.environmentId,
    projectId: options.projectId,
    serviceId: options.serviceId,
  }).catch(() => ({ domains: { customDomains: [] as CustomDomainNode[] } }));

  const found = listed.domains.customDomains.find(
    (d) => d.domain === options.domain
  );
  if (found) return parseCustomDomain(found);

  const created = await railwayGql(options.token, CustomDomainCreateMutation, {
    input: {
      serviceId: options.serviceId,
      environmentId: options.environmentId,
      projectId: options.projectId,
      domain: options.domain,
      targetPort: options.targetPort,
    },
  });
  return parseCustomDomain(created.customDomainCreate);
}

function parseCustomDomain(raw: {
  id: string;
  domain: string;
  status: {
    verificationToken?: string | null;
    dnsRecords: ReadonlyArray<{
      recordType: string;
      requiredValue: string;
    }>;
  };
}): RailwayCustomDomain {
  const cname = raw.status.dnsRecords.find(
    (r) => r.recordType === 'DNS_RECORD_TYPE_CNAME'
  );
  return {
    id: raw.id,
    domain: raw.domain,
    cnameTarget: cname?.requiredValue ?? null,
    verificationToken: raw.status.verificationToken ?? null,
  };
}

export async function ensureServiceDomain(options: {
  readonly token: string;
  readonly serviceId: string;
  readonly environmentId: string;
}): Promise<string | null> {
  try {
    const created = await railwayGql(
      options.token,
      ServiceDomainCreateMutation,
      {
        input: {
          serviceId: options.serviceId,
          environmentId: options.environmentId,
        },
      }
    );
    return created.serviceDomainCreate.domain;
  } catch {
    return null;
  }
}

export async function ensureVolume(options: {
  readonly token: string;
  readonly projectId: string;
  readonly environmentId: string;
  readonly serviceId: string;
  readonly mountPath: string;
}): Promise<void> {
  try {
    await railwayGql(options.token, VolumeCreateMutation, {
      input: {
        projectId: options.projectId,
        environmentId: options.environmentId,
        serviceId: options.serviceId,
        mountPath: options.mountPath,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/already|exist|duplicate/i.test(msg)) {
      console.warn('[railway] volumeCreate:', msg);
    }
  }
}

export async function redeployService(options: {
  readonly token: string;
  readonly serviceId: string;
  readonly environmentId: string;
}): Promise<void> {
  try {
    await railwayGql(options.token, ServiceInstanceRedeployMutation, {
      serviceId: options.serviceId,
      environmentId: options.environmentId,
    });
    return;
  } catch {
    // fall through
  }
  await railwayGql(options.token, ServiceInstanceDeployV2Mutation, {
    serviceId: options.serviceId,
    environmentId: options.environmentId,
  });
}

/** Deploy `commitSha` (or the branch tip) with the service's current variables. */
export async function deployServiceCommit(options: {
  readonly token: string;
  readonly serviceId: string;
  readonly environmentId: string;
  readonly commitSha?: string;
}): Promise<void> {
  await railwayGql(options.token, ServiceInstanceDeployV2Mutation, {
    serviceId: options.serviceId,
    environmentId: options.environmentId,
    ...(options.commitSha === undefined
      ? {}
      : { commitSha: options.commitSha }),
  });
}

export async function deleteService(
  token: string,
  serviceId: string
): Promise<void> {
  await railwayGql(token, ServiceDeleteMutation, { id: serviceId }).catch(
    () => undefined
  );
}
