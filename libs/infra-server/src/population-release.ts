/**
 * How the Synthetic Population Worker is published: Railway's Bun builder,
 * the same install and start the process uses on a machine. No image.
 */

export const POPULATION_BUILD_COMMAND =
  'ONNXRUNTIME_NODE_INSTALL=skip bun install --frozen-lockfile --ignore-scripts && bun run generate';

export const POPULATION_START_COMMAND =
  'bun --conditions=browser --conditions=development apps/synthetic-population-worker/src/main.ts';

export type PopulationDeployment = {
  readonly projectId: string;
  readonly environmentId: string;
  readonly serviceId: string;
};

/** Config Railway reads from the archive root for this deploy only. */
export function populationRailwayConfig(): string {
  return `${JSON.stringify(
    {
      $schema: 'https://railway.com/railway.schema.json',
      build: {
        builder: 'RAILPACK',
        buildCommand: POPULATION_BUILD_COMMAND,
      },
      deploy: {
        startCommand: POPULATION_START_COMMAND,
      },
    },
    null,
    2
  )}\n`;
}

/**
 * Set the commit as the runtime version, then upload the archive.
 * `--skip-deploys` keeps the variable write from starting a second deploy.
 * CLI 5.64.2 accepts `--ci` on `up`, not on `variable set`.
 */
export function populationReleaseArgs(
  railway: readonly string[],
  version: string,
  deployment: PopulationDeployment,
  stage: string
): {
  readonly versionArgs: readonly string[];
  readonly upArgs: readonly string[];
} {
  const target = [
    '--project',
    deployment.projectId,
    '--environment',
    deployment.environmentId,
    '--service',
    deployment.serviceId,
  ] as const;
  return {
    versionArgs: [
      ...railway,
      'variable',
      'set',
      `DEPLOYMENT_VERSION=${version}`,
      ...target,
      '--skip-deploys',
    ],
    upArgs: [
      ...railway,
      'up',
      stage,
      '--path-as-root',
      ...target,
      '--ci',
      '--json',
      '--message',
      `Synthetic Population Worker ${version}`,
    ],
  };
}

/**
 * The Railway CLI reads `RAILWAY_TOKEN` as a project token. Ours is a
 * workspace token, which it reads as `RAILWAY_API_TOKEN`, and the project
 * token name wins when both are set.
 */
export function railwayCliEnvironment(
  env: Readonly<Record<string, string | undefined>>
): Record<string, string> {
  const { RAILWAY_TOKEN: workspaceToken, RAILWAY_API_TOKEN: _, ...rest } = env;
  return {
    ...Object.fromEntries(
      Object.entries(rest).filter(
        (entry): entry is [string, string] => entry[1] !== undefined
      )
    ),
    ...(workspaceToken === undefined
      ? {}
      : { RAILWAY_API_TOKEN: workspaceToken }),
  };
}
