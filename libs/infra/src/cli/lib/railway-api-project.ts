import { assert } from '@pkgs/assert';
import { print } from 'graphql';
import {
  pickProductionEnv,
  type RailwayProject,
  type RailwayService,
  railwayGql,
} from './railway-api-core';
import {
  ListProjectsQuery,
  ProjectCreateMutation,
  ServiceCreateMutation,
  ServiceInstanceUpdateMutation,
  VariableUpsertMutation,
} from './railway-graphql/documents';

export function listProjectsQuerySource(): string {
  return print(ListProjectsQuery);
}

export async function listProjects(token: string): Promise<
  ReadonlyArray<{
    readonly project: RailwayProject;
    readonly services: readonly RailwayService[];
  }>
> {
  const data = await railwayGql(token, ListProjectsQuery);
  const out: Array<{
    project: RailwayProject;
    services: RailwayService[];
  }> = [];
  for (const ws of data.me.workspaces) {
    for (const edge of ws.projects.edges) {
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

  const created = await railwayGql(token, ProjectCreateMutation, {
    input: { name },
  });
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

  const created = await railwayGql(options.token, ServiceCreateMutation, {
    input: {
      projectId: options.project.id,
      name: options.serviceName,
      source: { repo: options.githubRepo },
    },
  });
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
    await railwayGql(token, ServiceInstanceUpdateMutation, {
      serviceId,
      environmentId: options.project.environmentId,
      input: {
        rootDirectory: options.rootDirectory,
        dockerfilePath: 'Dockerfile',
      },
    });
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
    await railwayGql(options.token, VariableUpsertMutation, {
      input: {
        projectId: options.projectId,
        environmentId: options.environmentId,
        serviceId: options.serviceId,
        name,
        value,
      },
    });
  }
}
