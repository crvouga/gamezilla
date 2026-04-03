/**
 * Post-deploy infrastructure health checks. Verifies that ECS services are
 * stable and NLB target groups are healthy BEFORE running HTTP smoke tests.
 * This catches infrastructure issues (SG misconfigs, container crashes, etc.)
 * immediately instead of waiting for the HTTP retry loop to time out.
 */
import {
  DescribeServicesCommand,
  DescribeTasksCommand,
  ECSClient,
  ListClustersCommand,
  ListServicesCommand,
  ListTasksCommand,
} from '@aws-sdk/client-ecs';
import {
  DescribeTargetGroupsCommand,
  DescribeTargetHealthCommand,
  ElasticLoadBalancingV2Client,
} from '@aws-sdk/client-elastic-load-balancing-v2';
import { assert } from '@gamezilla/shared/assert';
import type { CiPlatform } from './ci-platform';
import { diagnoseElbFailures } from './elb-diagnostics';

const MAX_HEALTH_CHECK_RETRIES = 6;
const HEALTH_CHECK_INTERVAL_MS = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface InfraHealthContext {
  readonly platform: CiPlatform;
  readonly region: string;
}

/**
 * Runs all infrastructure health checks. Returns normally if everything is
 * healthy; throws with diagnostic output if any check fails.
 */
export async function checkInfrastructureHealth(
  ctx: InfraHealthContext
): Promise<void> {
  const { platform, region } = ctx;
  const ecsClient = new ECSClient({ region });
  const elbClient = new ElasticLoadBalancingV2Client({ region });

  platform.notice('Infrastructure health: checking ECS services...');
  const clusters = await discoverClusters(ecsClient);
  if (clusters.length === 0) {
    platform.warning('No ECS clusters found — skipping infrastructure health checks.');
    return;
  }

  let allHealthy = true;

  for (const clusterArn of clusters) {
    const clusterName = clusterArn.split('/').pop() ?? clusterArn;
    const serviceArns = await discoverServices(ecsClient, clusterArn);
    if (serviceArns.length === 0) continue;

    const services = await describeServices(ecsClient, clusterArn, serviceArns);

    for (const svc of services) {
      const svcName = svc.serviceName ?? '(unknown)';
      const healthy = await checkEcsServiceHealth(platform, svc, clusterName);
      if (!healthy) allHealthy = false;

      const tgArns = (svc.loadBalancers ?? [])
        .map((lb) => lb.targetGroupArn)
        .filter((arn): arn is string => arn !== undefined);

      for (const tgArn of tgArns) {
        const tgHealthy = await checkTargetGroupHealth(
          platform,
          elbClient,
          tgArn,
          svcName
        );
        if (!tgHealthy) {
          allHealthy = false;
          try {
            await diagnoseElbFailures({
              platform,
              region,
              clusterArn,
              serviceArn: svc.serviceArn ?? '',
            });
          } catch {
            /* best-effort */
          }
        }
      }
    }
  }

  if (!allHealthy) {
    assert.fail(
      'Infrastructure health checks failed — see diagnostic output above. ' +
        'Fix the underlying issue before the HTTP smoke tests can pass.'
    );
  }

  platform.notice('Infrastructure health: all ECS services and target groups healthy.');
}

async function discoverClusters(client: ECSClient): Promise<string[]> {
  try {
    const resp = await client.send(new ListClustersCommand({}));
    return resp.clusterArns ?? [];
  } catch {
    return [];
  }
}

async function discoverServices(
  client: ECSClient,
  clusterArn: string
): Promise<string[]> {
  try {
    const resp = await client.send(
      new ListServicesCommand({ cluster: clusterArn })
    );
    return resp.serviceArns ?? [];
  } catch {
    return [];
  }
}

async function describeServices(
  client: ECSClient,
  clusterArn: string,
  serviceArns: string[]
) {
  const resp = await client.send(
    new DescribeServicesCommand({
      cluster: clusterArn,
      services: serviceArns,
    })
  );
  return resp.services ?? [];
}

interface EcsServiceDescription {
  serviceName?: string;
  serviceArn?: string;
  runningCount?: number;
  desiredCount?: number;
  deployments?: Array<{
    rolloutState?: string;
    status?: string;
    desiredCount?: number;
    runningCount?: number;
  }>;
  events?: Array<{ createdAt?: Date; message?: string }>;
  loadBalancers?: Array<{ targetGroupArn?: string }>;
}

async function checkEcsServiceHealth(
  platform: CiPlatform,
  svc: EcsServiceDescription,
  clusterName: string
): Promise<boolean> {
  const name = svc.serviceName ?? '(unknown)';
  const running = svc.runningCount ?? 0;
  const desired = svc.desiredCount ?? 0;

  if (running < desired) {
    platform.error(
      `ECS service "${name}" in cluster "${clusterName}": running=${running} < desired=${desired}`
    );

    const recentEvents = (svc.events ?? []).slice(0, 5);
    for (const evt of recentEvents) {
      const ts = evt.createdAt?.toISOString() ?? '';
      const msg = evt.message ?? '';
      if (msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('error')) {
        platform.error(`  Event: ${ts} ${msg}`);
      }
    }

    return false;
  }

  const primaryDeploy = svc.deployments?.find((d) => d.status === 'PRIMARY');
  if (primaryDeploy && primaryDeploy.rolloutState === 'FAILED') {
    platform.error(
      `ECS service "${name}" in cluster "${clusterName}": deployment rollout FAILED`
    );
    return false;
  }

  platform.notice(
    `ECS service "${name}": running=${running}/${desired}, deployment OK`
  );
  return true;
}

async function checkTargetGroupHealth(
  platform: CiPlatform,
  elbClient: ElasticLoadBalancingV2Client,
  targetGroupArn: string,
  serviceName: string
): Promise<boolean> {
  const tgName = targetGroupArn.split('/').slice(-2).join('/');

  for (let attempt = 1; attempt <= MAX_HEALTH_CHECK_RETRIES; attempt++) {
    try {
      const health = await elbClient.send(
        new DescribeTargetHealthCommand({ TargetGroupArn: targetGroupArn })
      );
      const targets = health.TargetHealthDescriptions ?? [];

      if (targets.length === 0) {
        platform.warning(
          `Target group ${tgName} (${serviceName}): no targets registered (attempt ${attempt}/${MAX_HEALTH_CHECK_RETRIES})`
        );
        if (attempt < MAX_HEALTH_CHECK_RETRIES) {
          await sleep(HEALTH_CHECK_INTERVAL_MS);
          continue;
        }
        platform.error(
          `Target group ${tgName} (${serviceName}): no targets after ${MAX_HEALTH_CHECK_RETRIES} attempts`
        );
        return false;
      }

      const unhealthy = targets.filter(
        (t) => t.TargetHealth?.State !== 'healthy'
      );

      if (unhealthy.length === 0) {
        platform.notice(
          `Target group ${tgName} (${serviceName}): ${targets.length} target(s) healthy`
        );
        return true;
      }

      if (attempt < MAX_HEALTH_CHECK_RETRIES) {
        const initializing = unhealthy.filter(
          (t) => t.TargetHealth?.State === 'initial'
        );
        if (initializing.length > 0) {
          platform.notice(
            `Target group ${tgName} (${serviceName}): ${initializing.length} target(s) still initializing ` +
              `(attempt ${attempt}/${MAX_HEALTH_CHECK_RETRIES}, retrying in ${HEALTH_CHECK_INTERVAL_MS / 1000}s)`
          );
          await sleep(HEALTH_CHECK_INTERVAL_MS);
          continue;
        }
      }

      platform.error(
        `Target group ${tgName} (${serviceName}): ${unhealthy.length}/${targets.length} target(s) unhealthy`
      );
      for (const t of unhealthy) {
        const ip = t.Target?.Id ?? '?';
        const port = t.Target?.Port ?? '?';
        const state = t.TargetHealth?.State ?? 'unknown';
        const reason = t.TargetHealth?.Reason ?? '';
        const desc = t.TargetHealth?.Description ?? '';
        platform.error(`  ${ip}:${port} → ${state} (${reason}) ${desc}`);
      }
      return false;
    } catch (err) {
      platform.warning(
        `Could not check target group ${tgName}: ${err instanceof Error ? err.message : String(err)}`
      );
      if (attempt < MAX_HEALTH_CHECK_RETRIES) {
        await sleep(HEALTH_CHECK_INTERVAL_MS);
        continue;
      }
      return false;
    }
  }

  return false;
}
