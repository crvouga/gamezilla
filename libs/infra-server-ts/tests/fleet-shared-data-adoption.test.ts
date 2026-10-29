import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Block } from '@libs/infra-shared-ts/hcl-ast';
import { evaluate } from '@libs/infra-shared-ts/hcl-eval';
import { parseConfig } from '@libs/infra-shared-ts/hcl-parse';
import type { Value } from '@libs/infra-shared-ts/hcl-value';
import { sourceFiles } from '@libs/infra-shared-ts/infra-source';
import { technicalName } from '@libs/product-identity-shared-ts/technical-names';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const SHARED = technicalName(['shared']);
const fleet = join(
  import.meta.dirname,
  '../../infra-shared-ts/tofu/stacks/fleet'
);
const read = (name: string) =>
  parseConfig(readFileSync(join(fleet, name), 'utf8')).blocks;
const imports = read('shared-data-adoption.tf').filter(
  (block) => block.type === 'import'
);
const declarations = read('shared-data.tf');
const locals = declarations.find((block) => block.type === 'locals');
const secret = declarations.find(
  (block) => block.labels.join('.') === 'infisical_secret.shared_data'
);
const precondition = secret?.body.blocks.find(
  (block) => block.type === 'lifecycle'
)?.body.blocks[0];

function attr(
  block: Block | undefined,
  name: string,
  names: Record<string, Value>
): Value {
  const expression = block?.body.attributes.get(name);
  if (expression === undefined) throw new Error(`Missing ${name}`);
  return evaluate(expression, { names, files: sourceFiles(new Map()) });
}

function credential(
  tokenId: string,
  storedId: string,
  saved: string
): Record<string, Value> {
  return {
    cloudflare_account_token: { shared_data: { id: tokenId, value: null } },
    local: {
      stored_shared_data: {
        SHARED_DATA_ACCESS_KEY_ID: { value: storedId },
        SHARED_DATA_SECRET_ACCESS_KEY: { value: saved },
      },
      shared_data_secret: saved,
    },
  };
}

// regression: fleet-shared-data-forgotten-adoption
test('adopts the existing shared bucket, token and write-only secrets', () => {
  const names = {
    var: {
      global_imports: { shared_data: true },
      shared_data: {
        account_id: '2698e76355a8c8d1ee21e15fa9fd44f7',
        bucket: SHARED,
      },
      infisical: { project_id: 'project', shared_env: 'shared' },
    },
    ...credential('existing-token', 'existing-token', 'existing-s3-secret'),
    each: { value: SHARED },
  };
  expect(attr(imports[0], 'id', names)).toBe(
    `2698e76355a8c8d1ee21e15fa9fd44f7/${SHARED}/default`
  );
  expect(attr(imports[1], 'id', names)).toBe(
    '2698e76355a8c8d1ee21e15fa9fd44f7/existing-token'
  );
  expect(
    attr(imports[2], 'id', {
      ...names,
      each: { value: 'SHARED_DATA_SECRET_ACCESS_KEY' },
    })
  ).toBe('write-only:project:shared:/:SHARED_DATA_SECRET_ACCESS_KEY');
  expect(attr(locals, 'shared_data_secret', names)).toBe('existing-s3-secret');
  expect(attr(precondition, 'condition', names)).toBe(true);
});

test('imported credentials remain paired and nonempty', () => {
  assertProperty(
    'preserves imported credentials only for their own token',
    fc.property(
      fc.uuid(),
      fc.uuid(),
      fc.string({ minLength: 1 }),
      (tokenId, otherId, saved) => {
        const names = credential(tokenId, tokenId, saved);
        expect(attr(locals, 'shared_data_secret', names)).toBe(saved);
        expect(attr(precondition, 'condition', names)).toBe(true);
        expect(
          attr(precondition, 'condition', credential(tokenId, otherId, saved))
        ).toBe(tokenId === otherId);
        expect(
          attr(precondition, 'condition', credential(tokenId, tokenId, ''))
        ).toBe(false);
      }
    )
  );
});

test('fresh installations do not try to import nonexistent resources', () => {
  for (const block of imports) {
    expect(
      attr(block, 'for_each', {
        var: { global_imports: { shared_data: false } },
      })
    ).toEqual([]);
  }
});
