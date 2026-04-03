import assert from 'node:assert/strict';
import type * as ec2 from 'aws-cdk-lib/aws-ec2';

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

/**
 * ECS container health check timers must be within AWS limits and logically consistent.
 * The grace period must exceed startPeriod + interval * retries; otherwise the task gets
 * killed before the container health check can even complete.
 *
 * @see https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_HealthCheck.html
 */
export function assertEcsHealthCheckTimers(opts: {
  readonly intervalSeconds: number;
  readonly timeoutSeconds: number;
  readonly retries: number;
  readonly startPeriodSeconds: number;
  readonly gracePeriodSeconds: number;
  readonly context: string;
}): void {
  const { intervalSeconds, timeoutSeconds, retries, startPeriodSeconds, gracePeriodSeconds, context } = opts;

  assert.ok(
    Number.isInteger(intervalSeconds) && intervalSeconds >= 5 && intervalSeconds <= 300,
    `${context}: health check interval must be 5-300s (AWS limit). Got: ${intervalSeconds}s. ` +
      `Fix: Set interval between 5s and 300s.`
  );
  assert.ok(
    Number.isInteger(timeoutSeconds) && timeoutSeconds >= 2 && timeoutSeconds <= 120,
    `${context}: health check timeout must be 2-120s (AWS limit). Got: ${timeoutSeconds}s. ` +
      `Fix: Set timeout between 2s and 120s.`
  );
  assert.ok(
    timeoutSeconds < intervalSeconds,
    `${context}: health check timeout (${timeoutSeconds}s) must be less than interval (${intervalSeconds}s). ` +
      `Fix: timeout < interval so the next check doesn't start before the previous one finishes.`
  );
  assert.ok(
    Number.isInteger(retries) && retries >= 1 && retries <= 10,
    `${context}: health check retries must be 1-10 (AWS limit). Got: ${retries}. ` +
      `Fix: Set retries between 1 and 10.`
  );
  assert.ok(
    Number.isInteger(startPeriodSeconds) && startPeriodSeconds >= 0 && startPeriodSeconds <= 300,
    `${context}: health check startPeriod must be 0-300s (AWS limit). Got: ${startPeriodSeconds}s. ` +
      `Fix: Set startPeriod between 0s and 300s.`
  );

  const worstCaseHealthCheckDuration = startPeriodSeconds + intervalSeconds * retries;
  assert.ok(
    gracePeriodSeconds >= worstCaseHealthCheckDuration,
    `${context}: healthCheckGracePeriod (${gracePeriodSeconds}s) is shorter than worst-case health check ` +
      `duration (startPeriod ${startPeriodSeconds}s + interval ${intervalSeconds}s × retries ${retries} = ${worstCaseHealthCheckDuration}s). ` +
      `Tasks will be killed before health checks can pass. ` +
      `Fix: Set gracePeriod ≥ ${worstCaseHealthCheckDuration}s.`
  );
}

/**
 * NLB target group health checks have different constraints than ALB.
 * TCP health checks require interval ≥ 10s and thresholds in [2, 10].
 *
 * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/network/target-group-health-checks.html
 */
export function assertNlbTargetGroupHealthCheck(opts: {
  readonly protocol: string;
  readonly intervalSeconds: number;
  readonly healthyThresholdCount: number;
  readonly unhealthyThresholdCount: number;
  readonly context: string;
}): void {
  const { protocol, intervalSeconds, healthyThresholdCount: h, unhealthyThresholdCount: u, context } = opts;

  if (protocol === 'TCP' || protocol === 'TLS') {
    assert.ok(
      intervalSeconds === 10 || intervalSeconds === 30,
      `${context}: NLB TCP/TLS health check interval must be 10s or 30s (AWS limitation). Got: ${intervalSeconds}s. ` +
        `Fix: Set interval to 10 or 30.`
    );
  } else {
    assert.ok(
      intervalSeconds >= 5 && intervalSeconds <= 300,
      `${context}: NLB health check interval must be 5-300s. Got: ${intervalSeconds}s.`
    );
  }

  assert.ok(
    Number.isInteger(h) && h >= 2 && h <= 10,
    `${context}: NLB healthyThresholdCount must be in [2, 10] (AWS API). Got: ${h}. ` +
      `Fix: Set healthyThresholdCount between 2 and 10.`
  );
  assert.ok(
    Number.isInteger(u) && u >= 2 && u <= 10,
    `${context}: NLB unhealthyThresholdCount must be in [2, 10] (AWS API). Got: ${u}. ` +
      `Fix: Set unhealthyThresholdCount between 2 and 10.`
  );
}

/**
 * Fargate only supports specific cpu/memory combinations. Invalid combos silently
 * cause task launch failures.
 *
 * @see https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-cpu-memory-error.html
 */
const VALID_FARGATE_COMBOS: ReadonlyMap<number, readonly number[]> = new Map([
  [256, [512, 1024, 2048]],
  [512, [1024, 2048, 3072, 4096]],
  [1024, [2048, 3072, 4096, 5120, 6144, 7168, 8192]],
  [2048, [4096, 5120, 6144, 7168, 8192, 9216, 10240, 11264, 12288, 13312, 14336, 15360, 16384]],
  [4096, [8192, 9216, 10240, 11264, 12288, 13312, 14336, 15360, 16384, 17408, 18432, 19456, 20480, 21504, 22528, 23552, 24576, 25600, 26624, 27648, 28672, 29696, 30720]],
  [8192, [16384, 20480, 24576, 28672, 32768, 36864, 40960, 45056, 49152, 53248, 57344, 61440]],
  [16384, [32768, 40960, 49152, 57344, 65536, 73728, 81920, 90112, 98304, 106496, 114688, 122880]],
]);

export function assertFargateTaskResources(opts: {
  readonly cpu: number;
  readonly memoryMiB: number;
  readonly context: string;
}): void {
  const { cpu, memoryMiB, context } = opts;
  const validMemory = VALID_FARGATE_COMBOS.get(cpu);

  assert.ok(
    validMemory !== undefined,
    `${context}: Fargate CPU ${cpu} is not valid. Valid CPU values: ${[...VALID_FARGATE_COMBOS.keys()].join(', ')}. ` +
      `Fix: Use one of the supported CPU values. ` +
      `See https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-cpu-memory-error.html`
  );

  assert.ok(
    validMemory!.includes(memoryMiB),
    `${context}: Fargate CPU ${cpu} does not support memory ${memoryMiB} MiB. ` +
      `Valid memory for CPU ${cpu}: ${validMemory!.join(', ')} MiB. ` +
      `Fix: Choose a valid cpu/memory combination. ` +
      `See https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-cpu-memory-error.html`
  );
}

/**
 * Verify that a VPC actually has subnets matching the requested type.
 * Empty subnet selections silently break ECS services and load balancers —
 * tasks launch into no subnet and CloudFormation hangs.
 */
export function assertVpcSubnetSelection(
  vpc: ec2.IVpc,
  subnetType: ec2.SubnetType,
  context: string
): void {
  const selected = vpc.selectSubnets({ subnetType });
  assert.ok(
    selected.subnets.length > 0,
    `${context}: VPC has no ${subnetType} subnets. ` +
      `ECS services and load balancers placed in this subnet type will fail to launch. ` +
      `Fix: Add subnets of type "${subnetType}" to the VPC configuration.`
  );
}
