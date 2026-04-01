/**
 * Pass to `cdk bootstrap --cloudformation-execution-policies` so the CLI does
 * not emit: "Using default execution policy ... Pass --cloudformation-execution-policies to customize."
 *
 * Behavior matches CDK’s default (full admin for the CFN deploy role); this only makes the choice explicit.
 */
export const CDK_BOOTSTRAP_CLOUDFORMATION_EXECUTION_POLICY =
  'arn:aws:iam::aws:policy/AdministratorAccess' as const;
