import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GLOBAL } from '@libs/infra-shared-ts/global';
import { technicalName } from '@libs/product-identity-shared-ts/technical-names';

const FOUNDATION = join(
  import.meta.dirname,
  '../../infra-shared-ts/tofu/stacks/foundation/terraform.tf'
);
const DATABASE = join(
  import.meta.dirname,
  '../../infra-shared-ts/tofu/modules/database/main.tf'
);
const IMPORTS = join(
  import.meta.dirname,
  '../../infra-shared-ts/tofu/stacks/foundation/imports.tf'
);
const AWS_CI = join(
  import.meta.dirname,
  '../../infra-shared-ts/tofu/modules/aws-ci-identity/main.tf'
);
const BOOTSTRAP = join(
  import.meta.dirname,
  '../../infra-shared-ts/tofu/stacks/bootstrap/main.tf'
);
const HEALTH_WORKFLOW = join(
  import.meta.dirname,
  '../../../.github/workflows/health.yml'
);
const OBSERVABILITY_VIEWS = join(
  import.meta.dirname,
  '../../infra-shared-ts/tofu/modules/observability-views/main.tf'
);
const OBSERVABILITY_ALERTS = join(
  import.meta.dirname,
  '../../infra-shared-ts/tofu/modules/observability-views/alerts.tf'
);
const OBSERVABILITY_WIRING = join(
  import.meta.dirname,
  '../../infra-shared-ts/tofu/stacks/foundation/observability-views.tf'
);
const OBSERVABILITY = join(
  import.meta.dirname,
  '../../infra-shared-ts/tofu/modules/observability/main.tf'
);
const FOUNDATION_MAIN = join(
  import.meta.dirname,
  '../../infra-shared-ts/tofu/stacks/foundation/main.tf'
);
const FLEET_VARIABLES = join(
  import.meta.dirname,
  '../../infra-shared-ts/tofu/stacks/fleet/variables.tf'
);
const RAILWAY_PROJECT = join(
  import.meta.dirname,
  '../../infra-shared-ts/tofu/stacks/fleet/railway.tf'
);

describe('foundation bootstrap', () => {
  // regression: foundation-provider-bootstrap-cycle
  test('a first plan never connects through the Postgres role it is creating', () => {
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
    expect(imports.match(/destroy = false/g)?.length).toBe(17);
  });

  // regression: neki-role-drop-blocks-postgres
  test('postgres is a new database and the Neki addresses are forgotten', () => {
    const main = readFileSync(FOUNDATION_MAIN, 'utf8');
    const imports = readFileSync(IMPORTS, 'utf8');
    const addresses = [
      'module.database.planetscale_neki_branch.production',
      'module.database.planetscale_neki_branch.standard',
      'module.database.planetscale_neki_role.migrate',
      'module.database.planetscale_neki_role.app',
      'module.database.planetscale_neki_role.obs_read',
    ];

    expect(main).toContain(
      'database_name   = "${var.project}-${var.suffix}-pg"'
    );
    const forgotten = imports
      .split('removed {')
      .slice(1)
      .filter((block) => block.includes('planetscale_neki_'));
    expect(forgotten).toHaveLength(addresses.length);
    for (const address of addresses) {
      const block = forgotten.find((entry) =>
        entry.includes(`from = ${address}\n`)
      );
      expect(block).toBeDefined();
      expect(block).toContain('destroy = false');
      expect(block).not.toContain('[');
    }
  });

  // regression: grafana-views-read-before-token
  test('the first foundation plan does not read Grafana with the token it is creating', () => {
    const views = readFileSync(OBSERVABILITY_VIEWS, 'utf8');
    const alerts = readFileSync(OBSERVABILITY_ALERTS, 'utf8');
    const wiring = readFileSync(OBSERVABILITY_WIRING, 'utf8');

    expect(views).not.toContain('data "grafana_data_source"');
    expect(alerts).not.toContain('data.grafana_data_source');
    expect(views).toContain('metrics_uid = "grafanacloud-prom"');
    expect(views).toContain('logs_uid    = "grafanacloud-logs"');
    expect(wiring).toContain(
      'grafana_cloud_stack_service_account_token.observability[0].key'
    );
    expect(wiring).not.toContain('data "grafana_data_source"');
  });

  // regression: grafana-archived-instance-health
  test('dashboards are created only while the Grafana instance is active', () => {
    const module = readFileSync(OBSERVABILITY, 'utf8');
    const wiring = readFileSync(OBSERVABILITY_WIRING, 'utf8');

    expect(module).toContain(
      'value = data.grafana_cloud_stack.this.status == "active"'
    );
    expect(
      wiring.match(/module\.observability\.grafana_instance_ready \? 1 : 0/g)
        ?.length
    ).toBe(3);
    expect(wiring).toContain('"instance-not-active"');
    expect(wiring).not.toContain('data "grafana_data_source"');
  });

  // regression: archived-grafana-orphan-refresh
  test('archived views and credentials are retained instead of deleted', () => {
    const files = [
      OBSERVABILITY_VIEWS,
      OBSERVABILITY_ALERTS,
      OBSERVABILITY_WIRING,
      join(
        import.meta.dirname,
        '../../infra-shared-ts/tofu/modules/observability-views/slos.tf'
      ),
    ];
    let resources = 0;
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const blocks = source.split(/resource "grafana[^\n]+\{\n/).slice(1);
      for (const block of blocks) {
        expect(block).toMatch(/^\s*lifecycle\s*\{\s*destroy = false\s*\}/);
        resources += 1;
      }
    }
    expect(resources).toBe(6);
  });

  // regression: railway-project-name-over-32
  test('the shared Railway project name is between 1 and 32 characters', () => {
    const railway = readFileSync(RAILWAY_PROJECT, 'utf8');
    const variables = readFileSync(FLEET_VARIABLES, 'utf8');

    expect(railway).toMatch(/name\s*=\s*var.project/);
    expect(variables).toContain(
      'length(var.project) >= 1 && length(var.project) <= 32'
    );
    expect(GLOBAL.project.length).toBeGreaterThanOrEqual(1);
    expect(GLOBAL.project.length).toBeLessThanOrEqual(32);
    // The per-environment name it replaced did not fit.
    expect(
      technicalName(['development', 'synthetic', 'population']).length
    ).toBeGreaterThan(32);
  });

  // regression: neki-aws-region-name-is-not-region-slug
  test('uses the PlanetScale region slug for AWS us-east-1', () => {
    expect(GLOBAL.planetscale.region).toBe('us-east');
  });

  // regression: health-branch-aws-oidc-read-role — a workflow_dispatch on
  // refs/heads/fix-deploy-ci-aws-role-arn was rejected by AWS STS because the
  // only role trusted main, while broadening that deploy role would let a
  // feature branch mutate the account.
  test('branch health checks use a separate read-only AWS role', () => {
    const awsCi = readFileSync(AWS_CI, 'utf8');
    const bootstrap = readFileSync(BOOTSTRAP, 'utf8');
    const health = readFileSync(HEALTH_WORKFLOW, 'utf8');

    expect(awsCi).toContain('"${var.github_subject_prefix}:ref:refs/heads/*"');
    expect(awsCi).toContain('resource "aws_iam_role_policy" "health"');
    expect(awsCi).not.toMatch(
      /resource "aws_iam_role_policy" "health"[\s\S]*?Action = \[[\s\S]*?"(?:iot|lambda|logs|acm|iam):(Create|Delete|Update|Put|Tag|Untag|Attach|Detach|Add|Remove|Request)/
    );
    expect(bootstrap).toContain(
      'AWS_HEALTH_ROLE_ARN = module.aws_ci.health_role_arn'
    );
    expect(health).toContain('AWS_ROLE_ARN: ${{ vars.AWS_HEALTH_ROLE_ARN }}');
  });
});

test('bootstrap declares all CI coordinates as GitHub Actions variables', () => {
  const bootstrap = readFileSync(BOOTSTRAP, 'utf8');
  for (const name of [
    'SECRETS_IDENTITY_ID',
    'SECRETS_PROJECT_ID',
    'AWS_ROLE_ARN',
    'AWS_HEALTH_ROLE_ARN',
  ])
    expect(bootstrap).toContain(`${name} `);
});
