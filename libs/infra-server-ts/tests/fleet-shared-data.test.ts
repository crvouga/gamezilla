import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseConfig } from '@libs/infra-shared-ts/hcl-parse';
import { exprRefs } from '@libs/infra-shared-ts/hcl-refs';

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

const fleet = join(
  import.meta.dirname,
  '../../infra-shared-ts/tofu/stacks/fleet'
);
const blocks = readdirSync(fleet)
  .filter((name) => name.endsWith('.tf'))
  .flatMap(
    (name) => parseConfig(readFileSync(join(fleet, name), 'utf8')).blocks
  );

// regression: fleet-shared-data-retirement-conflict
test('fleet never retires a resource it also manages', () => {
  const managed = new Set(
    blocks
      .filter((block) => block.type === 'resource')
      .map((block) => block.labels.join('.'))
  );
  for (const block of blocks.filter((entry) => entry.type === 'removed')) {
    const from = block.body.attributes.get('from');
    expect(from).toBeDefined();
    if (from === undefined) throw new Error('Missing retirement address');
    for (const ref of exprRefs(from)) {
      expect(managed.has([ref.root, ...ref.path].join('.'))).toBe(false);
    }
  }
});

// regression: fleet-branch-shared-data-deletion
test('fleet manages every existing shared-data address without deleting it', () => {
  for (const address of LIVE_ADDRESSES) {
    const resource = address.split('[')[0];
    const block = blocks.find(
      (entry) =>
        entry.type === 'resource' && entry.labels.join('.') === resource
    );
    expect(block, address).toBeDefined();
    if (address.includes('[')) {
      expect(block?.body.attributes.has('for_each'), address).toBe(true);
    }
  }
  const bucket = blocks.find(
    (entry) =>
      entry.type === 'resource' && entry.labels.join('.') === LIVE_ADDRESSES[0]
  );
  const lifecycle = bucket?.body.blocks.find(
    (entry) => entry.type === 'lifecycle'
  );
  expect(lifecycle?.body.attributes.get('prevent_destroy')).toEqual({
    kind: 'literal',
    value: true,
  });
});
