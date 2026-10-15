import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseConfig } from '@libs/infra-shared/hcl-parse';
import { exprRefs } from '@libs/infra-shared/hcl-refs';

// The twelve deletions from Deploy run 38723618679: a branch provisioned
// these resources in shared fleet state before their declarations reached main.
const LIVE_ADDRESSES = [
  'cloudflare_r2_bucket.shared_data',
  'cloudflare_account_token.shared_data',
  'infisical_secret.shared_data["SHARED_DATA_BUCKET"]',
  'infisical_secret.shared_data["SHARED_DATA_ENDPOINT"]',
  'infisical_secret.shared_data["SHARED_DATA_REGION"]',
  'infisical_secret.shared_data["SHARED_DATA_ACCESS_KEY_ID"]',
  'infisical_secret.shared_data["SHARED_DATA_SECRET_ACCESS_KEY"]',
  'terraform_data.shared_data_version["SHARED_DATA_BUCKET"]',
  'terraform_data.shared_data_version["SHARED_DATA_ENDPOINT"]',
  'terraform_data.shared_data_version["SHARED_DATA_REGION"]',
  'terraform_data.shared_data_version["SHARED_DATA_ACCESS_KEY_ID"]',
  'terraform_data.shared_data_version["SHARED_DATA_SECRET_ACCESS_KEY"]',
];

// regression: fleet-branch-shared-data-deletion
test('main preserves branch-provisioned shared data and its access credentials', () => {
  const imports = readFileSync(
    join(
      import.meta.dirname,
      '../../infra-shared/tofu/stacks/fleet/imports.tf'
    ),
    'utf8'
  );
  const removed = parseConfig(imports).blocks.filter(
    (block) => block.type === 'removed'
  );

  for (const address of LIVE_ADDRESSES) {
    const resource = address.split('[')[0];
    const block = removed.find((entry) => {
      const from = entry.body.attributes.get('from');
      if (from === undefined) return false;
      return exprRefs(from).some(
        (ref) => [ref.root, ...ref.path].join('.') === resource
      );
    });
    expect(block, address).toBeDefined();
    const lifecycle = block?.body.blocks.find(
      (entry) => entry.type === 'lifecycle'
    );
    expect(lifecycle?.body.attributes.get('destroy'), address).toEqual({
      kind: 'literal',
      value: false,
    });
  }
});
