import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FOUNDATION = join(
  import.meta.dirname,
  '../tofu/stacks/foundation/terraform.tf'
);
const DATABASE = join(import.meta.dirname, '../tofu/modules/database/main.tf');
const IMPORTS = join(
  import.meta.dirname,
  '../tofu/stacks/foundation/imports.tf'
);
const GLOBAL_VARIABLES = join(
  import.meta.dirname,
  '../tofu/global.tfvars.json'
);

describe('foundation bootstrap', () => {
  // regression: foundation-provider-bootstrap-cycle
  test('a first plan never connects through the Neki role it is creating', () => {
    const foundation = readFileSync(FOUNDATION, 'utf8');
    const database = readFileSync(DATABASE, 'utf8');

    expect(foundation).not.toContain('provider "postgresql"');
    expect(foundation).not.toContain('cyrilgdn/postgresql');
    expect(database).not.toContain('postgresql_extension');
    expect(database).not.toContain('output "connection"');
  });

  test('retired Neon and Railway resources are forgotten without deletion', () => {
    const imports = readFileSync(IMPORTS, 'utf8');
    expect(imports).toContain('from = module.database.neon_branch.this');
    expect(imports).toContain(
      'from = module.database.postgresql_extension.pg_stat_statements'
    );
    expect(imports).toContain('from = module.pubsub.railway_project.this');
    expect(imports).toContain(
      'from = module.secrets.random_password.generated'
    );
    expect(imports.match(/destroy = false/g)?.length).toBe(12);
  });

  // regression: neki-aws-region-name-is-not-region-slug
  test('uses the PlanetScale Neki slug for AWS us-east-1', () => {
    const variables = JSON.parse(readFileSync(GLOBAL_VARIABLES, 'utf8')) as {
      planetscale: { region: string };
    };

    expect(variables.planetscale.region).toBe('us-east');
  });
});
