import { expect, test } from 'bun:test';
import { evaluate } from '@libs/infra-shared-ts/hcl-eval';
import { parseConfig } from '@libs/infra-shared-ts/hcl-parse';
import { sourceFiles } from '@libs/infra-shared-ts/infra-source';

// regression: migration-role-owns-drill-table
test('standard teardown reassigns tables owned by the migration role', async () => {
  const source = await Bun.file(
    new URL('../tofu/modules/database/main.tf', import.meta.url)
  ).text();
  const role = parseConfig(source).blocks.find(
    (block) =>
      block.type === 'resource' &&
      block.labels[0] === 'planetscale_postgres_branch_role' &&
      block.labels[1] === 'migrate'
  );
  const successor = role?.body.attributes.get('successor');
  if (!successor) throw new Error('Migration role has no teardown successor');
  const files = sourceFiles(new Map());
  const forProtection = (production: boolean) =>
    evaluate(successor, { files, names: { var: { production } } });
  expect(forProtection(false)).toBe('postgres');
  expect(forProtection(true)).toBeNull();
});
