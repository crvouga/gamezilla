import { railwayGql, type RailwayCustomDomain } from './railway-api-core';

export async function ensureCustomDomain(options: {
  readonly token: string;
  readonly serviceId: string;
  readonly environmentId: string;
  readonly domain: string;
  readonly targetPort: number;
}): Promise<RailwayCustomDomain> {
  const listed = await railwayGql<{
    domains: {
      customDomains?: ReadonlyArray<{
        id: string;
        domain: string;
        status?: {
          dnsRecords?: ReadonlyArray<{
            requiredValue?: string;
            type?: string;
          }>;
          verificationToken?: string;
        };
      }>;
    };
  }>(
    options.token,
    `query($environmentId: String!, $serviceId: String!) {
      domains(environmentId: $environmentId, serviceId: $serviceId) {
        customDomains { id domain status }
      }
    }`,
    {
      environmentId: options.environmentId,
      serviceId: options.serviceId,
    }
  ).catch(() => ({ domains: { customDomains: [] } }));

  const found = listed.domains.customDomains?.find(
    (d) => d.domain === options.domain
  );
  if (found) return parseCustomDomain(found);

  const created = await railwayGql<{
    customDomainCreate: {
      id: string;
      domain: string;
      status?: {
        dnsRecords?: ReadonlyArray<{
          requiredValue?: string;
          type?: string;
        }>;
        verificationToken?: string;
      };
    };
  }>(
    options.token,
    `mutation($input: CustomDomainCreateInput!) {
      customDomainCreate(input: $input) {
        id
        domain
        status
      }
    }`,
    {
      input: {
        serviceId: options.serviceId,
        environmentId: options.environmentId,
        domain: options.domain,
        targetPort: options.targetPort,
      },
    }
  );
  return parseCustomDomain(created.customDomainCreate);
}

function parseCustomDomain(raw: {
  id: string;
  domain: string;
  status?: {
    dnsRecords?: ReadonlyArray<{
      requiredValue?: string;
      type?: string;
    }>;
    verificationToken?: string;
  };
}): RailwayCustomDomain {
  const cname = raw.status?.dnsRecords?.find(
    (r) => (r.type ?? '').toUpperCase() === 'CNAME'
  );
  return {
    id: raw.id,
    domain: raw.domain,
    cnameTarget: cname?.requiredValue ?? null,
    verificationToken: raw.status?.verificationToken ?? null,
  };
}

export async function ensureServiceDomain(options: {
  readonly token: string;
  readonly serviceId: string;
  readonly environmentId: string;
}): Promise<string | null> {
  try {
    const created = await railwayGql<{
      serviceDomainCreate: { domain: string };
    }>(
      options.token,
      `mutation($input: ServiceDomainCreateInput!) {
        serviceDomainCreate(input: $input) { domain }
      }`,
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
  readonly name: string;
}): Promise<void> {
  try {
    await railwayGql(
      options.token,
      `mutation($input: VolumeCreateInput!) {
        volumeCreate(input: $input) { id }
      }`,
      {
        input: {
          projectId: options.projectId,
          environmentId: options.environmentId,
          serviceId: options.serviceId,
          mountPath: options.mountPath,
          name: options.name,
        },
      }
    );
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
    await railwayGql(
      options.token,
      `mutation($serviceId: String!, $environmentId: String!) {
        serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
      }`,
      {
        serviceId: options.serviceId,
        environmentId: options.environmentId,
      }
    );
    return;
  } catch {
    // fall through
  }
  await railwayGql(
    options.token,
    `mutation($serviceId: String!, $environmentId: String!) {
      serviceInstanceDeployV2(serviceId: $serviceId, environmentId: $environmentId)
    }`,
    {
      serviceId: options.serviceId,
      environmentId: options.environmentId,
    }
  );
}

export async function deleteService(
  token: string,
  serviceId: string
): Promise<void> {
  await railwayGql(token, `mutation($id: String!) { serviceDelete(id: $id) }`, {
    id: serviceId,
  }).catch(() => undefined);
}
