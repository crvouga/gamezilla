import {
  DescribeServicesCommand,
  ECSClient,
  ListClustersCommand,
  ListServicesCommand,
} from '@aws-sdk/client-ecs';
import {
  DescribeTargetHealthCommand,
  ElasticLoadBalancingV2Client,
} from '@aws-sdk/client-elastic-load-balancing-v2';
import { assert } from '@gamezilla/shared/assert';
import type { CiPlatform } from './ci-platform';

const MAX_HEALTH_CHECK_RETRIES = 6;
const HEALTH_CHECK_INTERVAL_MS = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface InfraHealthContext {
  readonly platform: CiPlatform;
  readonly region: string;
}

export async function checkInfrastructureHealth(ctx: InfraHealthContext): Promise<void> {
  const { platform, region } = ctx;
  const ecsClient = new ECSClient({ region });
  const elbClient = new ElasticLoadBalancingV2Client({ region });

  platform.notice('Infrastructure health: checking ECS services...');

  let clusterArns: string[];
  try {
    const resp = await ecsClient.send(new ListClustersCommand({}));
    clusterArns = resp.clusterArns ?? [];
  } catch {
    clusterArns = [];
  }

  if (clusterArns.length === 0) {
    platform.warning('No ECS clusters found — skipping infrastructure health checks.');
    return;
  }

  let allHealthy = true;

  for (const clusterArn of clusterArns) {
    const clusterName = clusterArn.split('/').pop() ?? clusterArn;

    let serviceArns: string[];
    try {
      const resp = await ecsClient.send(new ListServicesCommand({ cluster: clusterArn }));
      serviceArns = resp.serviceArns ?? [];
    } catch {
      continue;
    }
    if (serviceArns.length === 0) continue;

    let svcResp;
    try {
      svcResp = await ecsClient.send(
        new DescribeServicesCommand({ cluster: clusterArn, services: serviceArns })
      );
    } catch (err) {
      platform.warning(`Could not describe services in cluster ${clusterName}: ${err instanceof Error ? err.message : String(err)}`);
      allHealthy = false;
      continue;
    }

    for (const svc of svcResp.services ?? []) {
      const svcName = svc.serviceName ?? '(unknown)';
      const running = svc.runningCount ?? 0;
      const desired = svc.desiredCount ?? 0;

      if (running < desired) {
        platform.error(`ECS service "${svcName}" in "${clusterName}": running=${running} < desired=${desired}`);
        const recentEvents = (svc.events ?? []).slice(0, 5);
        for (const evt of recentEvents) {
          const msg = evt.message ?? '';
          if (msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('error')) {
            platform.error(`  Event: ${evt.createdAt?.toISOString() ?? ''} ${msg}`);
          }
        }
        allHealthy = false;
      } else {
        const primaryDeploy = svc.deployments?.find((d) => d.status === 'PRIMARY');
        if (primaryDeploy && primaryDeploy.rolloutState === 'FAILED') {
          platform.error(`ECS service "${svcName}" in "${clusterName}": deployment rollout FAILED`);
          allHealthy = false;
        } else {
          platform.notice(`ECS service "${svcName}": running=${running}/${desired}, deployment OK`);
        }
      }

      const tgArns = (svc.loadBalancers ?? [])
        .map((lb) => lb.targetGroupArn)
        .filter((arn): arn is string => arn !== undefined);

      for (const tgArn of tgArns) {
        const tgName = tgArn.split('/').slice(-2).join('/');
        let tgHealthy = false;

        for (let attempt = 1; attempt <= MAX_HEALTH_CHECK_RETRIES; attempt++) {
          try {
            const health = await elbClient.send(
              new DescribeTargetHealthCommand({ TargetGroupArn: tgArn })
            );
            const targets = health.TargetHealthDescriptions ?? [];

            if (targets.length === 0) {
              platform.warning(`Target group ${tgName}: no targets (attempt ${attempt}/${MAX_HEALTH_CHECK_RETRIES})`);
              if (attempt < MAX_HEALTH_CHECK_RETRIES) { await sleep(HEALTH_CHECK_INTERVAL_MS); continue; }
              platform.error(`Target group ${tgName}: no targets after ${MAX_HEALTH_CHECK_RETRIES} attempts`);
              break;
            }

            const unhealthy = targets.filter((t) => t.TargetHealth?.State !== 'healthy');
            if (unhealthy.length === 0) {
              platform.notice(`Target group ${tgName}: ${targets.length} target(s) healthy`);
              tgHealthy = true;
              break;
            }

            if (attempt < MAX_HEALTH_CHECK_RETRIES) {
              const initializing = unhealthy.filter((t) => t.TargetHealth?.State === 'initial');
              if (initializing.length > 0) {
                platform.notice(`Target group ${tgName}: ${initializing.length} target(s) still initializing (attempt ${attempt})`);
                await sleep(HEALTH_CHECK_INTERVAL_MS);
                continue;
              }
            }

            platform.error(`Target group ${tgName}: ${unhealthy.length}/${targets.length} target(s) unhealthy`);
            for (const t of unhealthy) {
              const ip = t.Target?.Id ?? '?';
              const port = t.Target?.Port ?? '?';
              const state = t.TargetHealth?.State ?? 'unknown';
              const reason = t.TargetHealth?.Reason ?? '';
              platform.error(`  ${ip}:${port} → ${state} (${reason})`);
            }
            break;
          } catch (err) {
            platform.warning(`Could not check target group ${tgName}: ${err instanceof Error ? err.message : String(err)}`);
            if (attempt < MAX_HEALTH_CHECK_RETRIES) { await sleep(HEALTH_CHECK_INTERVAL_MS); continue; }
            break;
          }
        }

        if (!tgHealthy) allHealthy = false;
      }
    }
  }

  if (!allHealthy) {
    assert.fail('Infrastructure health checks failed — see diagnostic output above.');
  }

  platform.notice('Infrastructure health: all ECS services and target groups healthy.');
}
