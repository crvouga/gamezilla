import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildInfraModel } from '@libs/infra-shared/infra-model';
import type { StackModel } from '@libs/infra-shared/infra-model-types';
import { fleetEnvResources } from '@libs/infra-shared/tofu-command';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

const PKG = join(import.meta.dirname, '..');
// Evaluate the Railway wiring itself; unrelated provider modules are covered
// by infra-map.test.ts and need not be rebuilt for every generated environment.
const FILES = [
  'tofu/global.tfvars.json',
  'tofu/envs/dev.tfvars.json',
  'tofu/stacks/fleet/main.tf',
  'tofu/stacks/fleet/railway.tf',
  'tofu/stacks/fleet/variables.tf',
  'tofu/stacks/fleet/terraform.tf',
  'tofu/stacks/foundation/synthetic-population.tf',
  'tofu/stacks/foundation/variables.tf',
  'tofu/stacks/foundation/terraform.tf',
  'tofu/modules/synthetic-population-service/main.tf',
  'policy/stateful.rego',
];
const SOURCES = new Map(
  FILES.map((file) => [file, readFileSync(join(PKG, file), 'utf8')])
);
const GLOBAL = JSON.parse(
  SOURCES.get('tofu/global.tfvars.json') ?? '{}'
) as Record<string, unknown>;
const DEV = JSON.parse(
  SOURCES.get('tofu/envs/dev.tfvars.json') ?? '{}'
) as Record<string, unknown>;

function sourcesFor(
  project: string,
  envs: readonly string[]
): Map<string, string> {
  const sources = new Map(SOURCES);
  for (const file of sources.keys()) {
    if (file.startsWith('tofu/envs/')) sources.delete(file);
  }
  sources.set(
    'tofu/global.tfvars.json',
    JSON.stringify({ ...GLOBAL, project })
  );
  for (const env of envs) {
    sources.set(
      `tofu/envs/${env}.tfvars.json`,
      JSON.stringify({ ...DEV, env })
    );
  }
  return sources;
}

function assertFoundation(foundation: StackModel, env: string): void {
  const node = (address: string) =>
    foundation.nodes.find((n) => n.address === address);
  expect(foundation.edges).toContainEqual({
    from: 'data.terraform_remote_state.fleet',
    to: 'data.railway_project.this',
  });
  expect(node('data.railway_environment.this')?.instances[0]?.label).toBe(env);
  expect(
    node('module.population_service.railway_service.worker')?.instances[0]
      ?.label
  ).toBe(`${env}-synthetic-population-worker`);
  for (const type of [
    'railway_service',
    'railway_service_instance',
    'railway_variable_collection',
  ]) {
    expect(foundation.edges).toContainEqual({
      from: 'data.railway_environment.this',
      to: `module.population_service.${type}.worker`,
    });
  }
}

test('any set of application environments shares one protected Railway project with isolated services', () => {
  assertProperty(
    'Railway project and environment ownership',
    fc.property(
      fc.stringMatching(/^[a-z][a-z0-9]{0,15}$/),
      fc.uniqueArray(
        fc
          .stringMatching(/^[a-z][a-z0-9]{0,7}$/)
          .filter((env) => env !== 'core'),
        {
          minLength: 2,
          maxLength: 4,
        }
      ),
      (project, envs) => {
        const model = buildInfraModel(sourcesFor(project, envs));
        const stacks = [
          ...model.globals,
          ...model.envs.flatMap((env) => env.stacks),
        ];
        expect(stacks.flatMap((stack) => stack.diagnostics)).toEqual([]);
        const projects = stacks
          .flatMap((stack) => stack.nodes)
          .filter(
            (node) => node.type === 'railway_project' && node.mode === 'managed'
          );
        expect(projects).toHaveLength(1);
        expect(projects[0]?.instances[0]?.label).toBe(project);
        expect(projects[0]?.preventDestroy).toBe(true);
        expect(projects[0]?.stateful).toBe(true);
        const fleet = model.globals.find((stack) => stack.stack === 'fleet');
        const environments = fleet?.nodes.find(
          (node) => node.address === 'railway_environment.this'
        );
        expect(
          environments?.instances.map((instance) => instance.key).sort()
        ).toEqual([...envs].sort());
        expect(environments?.stateful).toBe(true);
        for (const env of model.envs) {
          const foundation = env.stacks.find(
            (stack) => stack.stack === 'foundation'
          );
          expect(foundation).toBeDefined();
          if (foundation !== undefined) assertFoundation(foundation, env.env);
          expect(fleetEnvResources(env.env)).toEqual([
            `infisical_secret_import.shared["${env.env}"]`,
            `infisical_project_environment.this["${env.env}"]`,
            `railway_environment.this["${env.env}"]`,
          ]);
        }
      }
    )
  );
});

test('Railway environments fork an empty core and both stacks enforce environment scoping', () => {
  const fleet = SOURCES.get('tofu/stacks/fleet/railway.tf') ?? '';
  expect(fleet).toContain('default_environment = { name = "core" }');
  expect(fleet).toContain(
    'source_environment_id = railway_project.this.default_environment.id'
  );
  expect(fleet).not.toContain('resource "railway_service"');
  for (const stack of ['fleet', 'foundation']) {
    expect(SOURCES.get(`tofu/stacks/${stack}/terraform.tf`)).toContain(
      'provider "railway" { strict_env_scoping = true }'
    );
  }
});
