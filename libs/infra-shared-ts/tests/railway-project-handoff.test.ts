import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Block } from '@libs/infra-shared-ts/hcl-ast';
import { evaluate } from '@libs/infra-shared-ts/hcl-eval';
import { parseConfig } from '@libs/infra-shared-ts/hcl-parse';
import type { Value } from '@libs/infra-shared-ts/hcl-value';
import { sourceFiles } from '@libs/infra-shared-ts/infra-source';
import { NAMESPACE } from '@libs/product-identity-shared-ts/product-identity';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const PKG = join(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(PKG, path), 'utf8');
const FLEET = parseConfig(read('tofu/stacks/fleet/railway.tf'));
const FOUNDATION = parseConfig(
  read('tofu/stacks/foundation/synthetic-population.tf')
);

function block(
  blocks: readonly Block[],
  type: string,
  ...labels: string[]
): Block {
  const found = blocks.find(
    (entry) =>
      entry.type === type && entry.labels.join('.') === labels.join('.')
  );
  if (found === undefined)
    throw new Error(`Missing ${type} ${labels.join('.')}`);
  return found;
}

function attr(entry: Block, name: string, names: Record<string, Value>): Value {
  const expression = entry.body.attributes.get(name);
  if (expression === undefined) throw new Error(`Missing ${name}`);
  return evaluate(expression, { names, files: sourceFiles(new Map()) });
}

function assertHandoff(projectId: string, project: string): void {
  const output = block(FLEET.blocks, 'output', 'railway_project_id');
  const id = attr(output, 'value', {
    railway_project: { this: { id: projectId } },
  });
  expect(id).toBe(projectId);
  const lookup = block(FOUNDATION.blocks, 'data', 'railway_project', 'this');
  expect(lookup.body.attributes.has('name')).toBe(false);
  expect(
    attr(lookup, 'id', {
      var: { project },
      data: {
        terraform_remote_state: {
          fleet: { outputs: { railway_project_id: id } },
        },
      },
    })
  ).toBe(projectId);
}

// regression: deploy-railway-workspace-project-name-lookup
test('dev uses the existing workspace project ID from Release 38555971896', () => {
  assertHandoff('32f967de-dc01-4822-bec1-6222694173db', NAMESPACE);
});

test('foundation addresses fleet projects independently of their names', () => {
  assertProperty(
    'Railway project ID handoff',
    fc.property(
      fc.uuid(),
      fc.string({ minLength: 1, maxLength: 32 }),
      assertHandoff
    )
  );
});

test('foundation reads the encrypted fleet backend with its existing state credentials', () => {
  const terraform = parseConfig(read('tofu/stacks/foundation/terraform.tf'));
  const encryption = block(
    block(terraform.blocks, 'terraform').body.blocks,
    'encryption'
  );
  const remote = block(encryption.body.blocks, 'remote_state_data_sources');
  const fleet = block(remote.body.blocks, 'remote_state_data_source', 'fleet');
  expect(fleet.body.attributes.get('method')).toEqual(
    block(encryption.body.blocks, 'state').body.attributes.get('method')
  );
  const state = block(
    FOUNDATION.blocks,
    'data',
    'terraform_remote_state',
    'fleet'
  );
  expect(attr(state, 'backend', {})).toBe('s3');
  expect(
    attr(state, 'config', {
      var: { state: { bucket: 'state-bucket', account_id: 'account' } },
    })
  ).toMatchObject({
    bucket: 'state-bucket',
    key: 'fleet/global.tfstate',
    region: 'auto',
    endpoints: { s3: 'https://account.r2.cloudflarestorage.com' },
    use_path_style: true,
    skip_credentials_validation: true,
    skip_region_validation: true,
    skip_requesting_account_id: true,
    skip_metadata_api_check: true,
    skip_s3_checksum: true,
  });
});
