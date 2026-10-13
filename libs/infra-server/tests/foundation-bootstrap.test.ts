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
    expect(imports.match(/destroy = false/g)?.length).toBe(12);
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
      'auth  = grafana_cloud_stack_service_account_token.observability.key'
    );
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
