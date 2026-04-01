import assert from 'node:assert/strict';

/**
 * EC2 security group descriptions must be ASCII-only (API rejects Unicode e.g. em dash).
 *
 * Uses `node:assert` (not `@gamezilla/shared`) so `tsc` for CDK `lib/` does not load the full
 * shared / react-native type graph (~2500+ files).
 *
 * @see https://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_CreateSecurityGroup.html
 */
export function assertAwsEc2SecurityGroupDescription(
  description: string,
  context: string
): void {
  assert.equal(
    typeof description,
    'string',
    `${context}: description must be a string`
  );
  assert.ok(description.length > 0, `${context}: description must be non-empty`);
  assert.ok(
    description.length <= 255,
    `${context}: security group description must be at most 255 characters`
  );
  assert.ok(
    /^[\x20-\x7E]+$/.test(description),
    `${context}: security group description must be printable ASCII only (no Unicode). Value: ${JSON.stringify(description)}`
  );
}

/**
 * Application load balancer target group health checks require thresholds in [2, 10].
 *
 * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html
 */
export function assertApplicationLoadBalancerTargetGroupHealthCheckCounts(opts: {
  readonly healthyThresholdCount: number;
  readonly unhealthyThresholdCount: number;
  readonly context: string;
}): void {
  const { healthyThresholdCount: h, unhealthyThresholdCount: u, context } =
    opts;
  assert.ok(
    Number.isInteger(h) && h >= 2 && h <= 10,
    `${context}: ALB healthyThresholdCount must be an integer in [2, 10] (AWS API). Got: ${String(h)}`
  );
  assert.ok(
    Number.isInteger(u) && u >= 2 && u <= 10,
    `${context}: ALB unhealthyThresholdCount must be an integer in [2, 10] (AWS API). Got: ${String(u)}`
  );
}
