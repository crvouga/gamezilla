import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FOUNDATION = join(
  import.meta.dirname,
  '../../infra-shared/tofu/stacks/foundation/terraform.tf'
);
const DATABASE = join(
  import.meta.dirname,
  '../../infra-shared/tofu/modules/database/main.tf'
);
const IMPORTS = join(
  import.meta.dirname,
  '../../infra-shared/tofu/stacks/foundation/imports.tf'
);
const GLOBAL_VARIABLES = join(
  import.meta.dirname,
  '../../infra-shared/tofu/global.tfvars.json'
);
const AWS_CI = join(
  import.meta.dirname,
  '../../infra-shared/tofu/modules/aws-ci-identity/main.tf'
);
const BOOTSTRAP = join(
  import.meta.dirname,
  '../../infra-shared/tofu/stacks/bootstrap/main.tf'
);
const HEALTH_WORKFLOW = join(
  import.meta.dirname,
  '../../../.github/workflows/health.yml'
);
const OBSERVABILITY_VIEWS = join(
  import.meta.dirname,
  '../../infra-shared/tofu/modules/observability-views/main.tf'
);
const OBSERVABILITY_ALERTS = join(
  import.meta.dirname,
  '../../infra-shared/tofu/modules/observability-views/alerts.tf'
);
const OBSERVABILITY_WIRING = join(
  import.meta.dirname,
  '../../infra-shared/tofu/stacks/foundation/observability-views.tf'
);
const OBSERVABILITY = join(
  import.meta.dirname,
  '../../infra-shared/tofu/modules/observability/main.tf'
);
const FOUNDATION_MAIN = join(
  import.meta.dirname,
  '../../infra-shared/tofu/stacks/foundation/main.tf'
);
const POPULATION = join(
  import.meta.dirname,
  '../../infra-shared/tofu/stacks/foundation/synthetic-population.tf'
);
const POPULATION_MODULE = join(
  import.meta.dirname,
  '../../infra-shared/tofu/modules/synthetic-population-service/main.tf'
);
const ENV_DIR = join(import.meta.dirname, '../../infra-shared/tofu/envs');

describe('foundation bootstrap', () => {
  // regression: railway-worker-builds-from-dockerfile
  test('the population worker is built from the uploaded source, not a Dockerfile', () => {
    const module = readFileSync(POPULATION_MODULE, 'utf8');
    expect(module).toMatch(/builder\s+=\s+"RAILPACK"/);
  });

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

  // regression: railway-project-name-over-32
  test('each Railway project name is between 1 and 32 characters', () => {
    const population = readFileSync(POPULATION, 'utf8');
    const module = readFileSync(POPULATION_MODULE, 'utf8');
    const global = JSON.parse(readFileSync(GLOBAL_VARIABLES, 'utf8')) as {
      project: string;
    };

    expect(population).toContain(
      'name         = "${var.project}-${var.env}-population"'
    );
    expect(module).toContain('length(var.name) >= 1 && length(var.name) <= 32');
    for (const file of ['dev.tfvars.json', 'prd.tfvars.json']) {
      const env = JSON.parse(readFileSync(join(ENV_DIR, file), 'utf8')) as {
        env: string;
      };
      const name = `${global.project}-${env.env}-population`;
      expect(name.length).toBeGreaterThanOrEqual(1);
      expect(name.length).toBeLessThanOrEqual(32);
    }
  });

  // regression: neki-aws-region-name-is-not-region-slug
  test('uses the PlanetScale region slug for AWS us-east-1', () => {
    const variables = JSON.parse(readFileSync(GLOBAL_VARIABLES, 'utf8')) as {
      planetscale: { region: string };
    };

    expect(variables.planetscale.region).toBe('us-east');
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
