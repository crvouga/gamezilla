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
  ServiceVariablesQuery,
  VariableUpsertMutation,
} from './railway-graphql/documents';

export function listProjectsQuerySource(): string {
  return print(ListProjectsQuery);
}

/**
 * Railway now requires `workspaceId` on `projectCreate`. Prefer an explicit
 * workspace name from `preferredWorkspaceName`; otherwise require a single workspace.
 */
export function pickRailwayWorkspaceId(
  workspaces: ReadonlyArray<{ readonly id: string; readonly name: string }>,
  preferredName?: string
): string {
  assert.ok(workspaces.length > 0, 'Railway account has no workspaces');
  if (preferredName !== undefined && preferredName.length > 0) {
    const match = workspaces.find((w) => w.name === preferredName);
    assert.ok(
      match !== undefined,
      `Railway workspace "${preferredName}" not found. Available: ${workspaces
        .map((w) => w.name)
        .join(', ')}`
    );
    return match.id;
  }
  if (workspaces.length === 1) {
    return workspaces[0]!.id;
  }
  throw new Error(
    `Railway account has ${String(workspaces.length)} workspaces; set preferredWorkspaceName. Available: ${workspaces
      .map((w) => w.name)
      .join(', ')}`
  );
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
  name: string,
  options?: { readonly preferredWorkspaceName?: string }
): Promise<RailwayProject> {
  const data = await railwayGql(token, ListProjectsQuery);
  for (const ws of data.me.workspaces) {
    for (const edge of ws.projects.edges) {
      const node = edge.node;
      if (node.name !== name) continue;
      const envs = node.environments.edges.map((e) => e.node);
      const environmentId = pickProductionEnv(envs);
      if (environmentId === '') continue;
      return { id: node.id, name: node.name, environmentId };
    }
  }

  const workspaceId = pickRailwayWorkspaceId(
    data.me.workspaces.map((w) => ({ id: w.id, name: w.name })),
    options?.preferredWorkspaceName
  );
  const created = await railwayGql(token, ProjectCreateMutation, {
    input: { name, workspaceId },
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
  /** Stage the values without Railway redeploying once per variable. */
  readonly skipDeploys?: boolean;
}): Promise<void> {
  for (const [name, value] of Object.entries(options.variables)) {
    await railwayGql(options.token, VariableUpsertMutation, {
      input: {
        projectId: options.projectId,
        environmentId: options.environmentId,
        serviceId: options.serviceId,
        name,
        value,
        ...(options.skipDeploys === true ? { skipDeploys: true } : {}),
      },
    });
  }
}

/** The service's current (unrendered) variables. */
export async function readServiceVariables(options: {
  readonly token: string;
  readonly projectId: string;
  readonly environmentId: string;
  readonly serviceId: string;
}): Promise<Readonly<Record<string, string>>> {
  const data = await railwayGql(options.token, ServiceVariablesQuery, {
    projectId: options.projectId,
    environmentId: options.environmentId,
    serviceId: options.serviceId,
  });
  return (data.variables ?? {}) as Record<string, string>;
}
