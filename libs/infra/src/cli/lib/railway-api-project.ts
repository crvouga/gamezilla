import { assert } from '@pkgs/assert';
import {
  pickProductionEnv,
  railwayGql,
  type RailwayProject,
  type RailwayService,
} from './railway-api-core';

type ProjectsQuery = {
  readonly me: {
    readonly workspaces: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly projects: {
            readonly edges: ReadonlyArray<{
              readonly node: {
                readonly id: string;
                readonly name: string;
                readonly environments: {
                  readonly edges: ReadonlyArray<{
                    readonly node: {
                      readonly id: string;
                      readonly name: string;
                    };
                  }>;
                };
                readonly services: {
                  readonly edges: ReadonlyArray<{
                    readonly node: {
                      readonly id: string;
                      readonly name: string;
                    };
                  }>;
                };
              };
            }>;
          };
        };
      }>;
    };
  };
};

export async function listProjects(token: string): Promise<
  ReadonlyArray<{
    readonly project: RailwayProject;
    readonly services: readonly RailwayService[];
  }>
> {
  const data = await railwayGql<ProjectsQuery>(
    token,
    `query {
      me {
        workspaces {
          edges {
            node {
              projects {
                edges {
                  node {
                    id
                    name
                    environments { edges { node { id name } } }
                    services { edges { node { id name } } }
                  }
                }
              }
            }
          }
        }
      }
    }`
  );
  const out: Array<{
    project: RailwayProject;
    services: RailwayService[];
  }> = [];
  for (const ws of data.me.workspaces.edges) {
    for (const edge of ws.node.projects.edges) {
      const node = edge.node;
      const envs = node.environments.edges.map((e) => e.node);
      const environmentId = pickProductionEnv(envs);
      if (environmentId === '') continue;
      out.push({
        project: { id: node.id, name: node.name, environmentId },
        services: node.services.edges.map((s) => ({
          id: s.node.id,
          name: s.node.name,
        })),
      });
    }
  }
  return out;
}

export async function ensureProject(
  token: string,
  name: string
): Promise<RailwayProject> {
  const existing = (await listProjects(token)).find(
    (p) => p.project.name === name
  );
  if (existing) return existing.project;

  const created = await railwayGql<{
    projectCreate: {
      id: string;
      name: string;
      environments: {
        edges: Array<{ node: { id: string; name: string } }>;
      };
    };
  }>(
    token,
    `mutation($input: ProjectCreateInput!) {
      projectCreate(input: $input) {
        id
        name
        environments { edges { node { id name } } }
      }
    }`,
    { input: { name } }
  );
  const envs = created.projectCreate.environments.edges.map((e) => e.node);
  const environmentId = pickProductionEnv(envs);
  assert.ok(environmentId.length > 0, 'Railway project has no environment');
  return {
    id: created.projectCreate.id,
    name: created.projectCreate.name,
    environmentId,
  };
}

export async function ensureService(options: {
  readonly token: string;
  readonly project: RailwayProject;
  readonly serviceName: string;
  readonly githubRepo: string;
  readonly rootDirectory: string;
}): Promise<RailwayService> {
  const listed = await listProjects(options.token);
  const match = listed.find((p) => p.project.id === options.project.id);
  const existing = match?.services.find((s) => s.name === options.serviceName);
  if (existing) {
    await configureServiceSource(options.token, existing.id, options);
    return existing;
  }

  const created = await railwayGql<{
    serviceCreate: { id: string; name: string };
  }>(
    options.token,
    `mutation($input: ServiceCreateInput!) {
      serviceCreate(input: $input) { id name }
    }`,
    {
      input: {
        projectId: options.project.id,
        name: options.serviceName,
        source: { repo: options.githubRepo },
      },
    }
  );
  const service = {
    id: created.serviceCreate.id,
    name: created.serviceCreate.name,
  };
  await configureServiceSource(options.token, service.id, options);
  return service;
}

async function configureServiceSource(
  token: string,
  serviceId: string,
  options: {
    readonly project: RailwayProject;
    readonly rootDirectory: string;
  }
): Promise<void> {
  try {
    await railwayGql(
      token,
      `mutation($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
        serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
      }`,
      {
        serviceId,
        environmentId: options.project.environmentId,
        input: {
          rootDirectory: options.rootDirectory,
          builder: 'DOCKERFILE',
          dockerfilePath: 'Dockerfile',
        },
      }
    );
  } catch {
    // Best-effort: service may already be configured / schema variant.
  }
}

export async function upsertVariables(options: {
  readonly token: string;
  readonly projectId: string;
  readonly environmentId: string;
  readonly serviceId: string;
  readonly variables: Readonly<Record<string, string>>;
}): Promise<void> {
  for (const [name, value] of Object.entries(options.variables)) {
    await railwayGql(
      options.token,
      `mutation($input: VariableUpsertInput!) {
        variableUpsert(input: $input)
      }`,
      {
        input: {
          projectId: options.projectId,
          environmentId: options.environmentId,
          serviceId: options.serviceId,
          name,
          value,
        },
      }
    );
  }
}
