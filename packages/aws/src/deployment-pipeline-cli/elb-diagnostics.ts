/**
 * ELB failure diagnostics: when an ECS service fails due to NLB/ALB health
 * check issues, automatically investigates target group health, load balancer
 * security group rules, and task ENI connectivity to pinpoint the root cause.
 *
 * This module automates the exact manual investigation steps that would
 * otherwise require 15+ AWS CLI commands to diagnose an NLB SG misconfiguration.
 */
import {
  DescribeLoadBalancersCommand,
  DescribeTargetGroupsCommand,
  DescribeTargetHealthCommand,
  ElasticLoadBalancingV2Client,
} from '@aws-sdk/client-elastic-load-balancing-v2';
import {
  DescribeNetworkInterfacesCommand,
  DescribeSecurityGroupsCommand,
  EC2Client,
} from '@aws-sdk/client-ec2';
import {
  DescribeServicesCommand,
  DescribeTasksCommand,
  ECSClient,
  ListTasksCommand,
} from '@aws-sdk/client-ecs';
import type { CiPlatform } from './ci-platform';

export interface ElbDiagnosticContext {
  readonly platform: CiPlatform;
  readonly region: string;
  readonly clusterArn: string;
  readonly serviceArn: string;
}

export async function diagnoseElbFailures(
  ctx: ElbDiagnosticContext
): Promise<void> {
  const { platform, region } = ctx;
  const elbClient = new ElasticLoadBalancingV2Client({ region });
  const ec2Client = new EC2Client({ region });
  const ecsClient = new ECSClient({ region });

  platform.error('\n╔══════════════════════════════════════════════╗');
  platform.error('║      ELB / NETWORKING FAILURE DIAGNOSIS       ║');
  platform.error('╚══════════════════════════════════════════════╝');

  const serviceInfo = await describeServiceLoadBalancers(
    platform,
    ecsClient,
    ctx.clusterArn,
    ctx.serviceArn
  );
  if (!serviceInfo) return;

  await diagnoseServiceEvents(platform, ecsClient, ctx.clusterArn, ctx.serviceArn);
  await diagnoseTargetGroupHealth(platform, elbClient, serviceInfo.targetGroupArns);
  await diagnoseLoadBalancerSecurityGroups(
    platform,
    elbClient,
    ec2Client,
    serviceInfo.targetGroupArns
  );
  await diagnoseStoppedTaskNetworking(
    platform,
    ecsClient,
    ec2Client,
    ctx.clusterArn,
    ctx.serviceArn
  );
}

interface ServiceLoadBalancerInfo {
  readonly targetGroupArns: string[];
}

async function describeServiceLoadBalancers(
  platform: CiPlatform,
  ecsClient: ECSClient,
  clusterArn: string,
  serviceArn: string
): Promise<ServiceLoadBalancerInfo | null> {
  try {
    const resp = await ecsClient.send(
      new DescribeServicesCommand({
        cluster: clusterArn,
        services: [serviceArn],
      })
    );
    const svc = resp.services?.[0];
    if (!svc) {
      platform.warning('Could not describe ECS service — may have been deleted during rollback.');
      return null;
    }

    const lbs = svc.loadBalancers ?? [];
    if (lbs.length === 0) {
      platform.error('ECS service has no load balancers attached — ELB diagnostics not applicable.');
      return null;
    }

    const tgArns = lbs
      .map((lb) => lb.targetGroupArn)
      .filter((arn): arn is string => arn !== undefined);

    platform.error(`\n--- Service load balancers (${tgArns.length} target groups) ---`);
    for (const lb of lbs) {
      platform.error(
        `  Container: ${lb.containerName}:${lb.containerPort} → TG: ${lb.targetGroupArn ?? '(none)'}`
      );
    }

    return { targetGroupArns: tgArns };
  } catch {
    platform.warning('Could not describe ECS service (cluster likely deleted during rollback).');
    return null;
  }
}

async function diagnoseServiceEvents(
  platform: CiPlatform,
  ecsClient: ECSClient,
  clusterArn: string,
  serviceArn: string
): Promise<void> {
  try {
    const resp = await ecsClient.send(
      new DescribeServicesCommand({
        cluster: clusterArn,
        services: [serviceArn],
      })
    );
    const events = resp.services?.[0]?.events?.slice(0, 10) ?? [];
    if (events.length === 0) return;

    platform.error('\n--- Recent ECS service events ---');
    for (const evt of events) {
      const ts = evt.createdAt ? evt.createdAt.toISOString() : '(unknown)';
      platform.error(`  ${ts}  ${evt.message ?? '(no message)'}`);
    }
  } catch {
    /* best-effort */
  }
}

async function diagnoseTargetGroupHealth(
  platform: CiPlatform,
  elbClient: ElasticLoadBalancingV2Client,
  targetGroupArns: string[]
): Promise<void> {
  if (targetGroupArns.length === 0) return;

  platform.error('\n--- Target group health ---');

  for (const tgArn of targetGroupArns) {
    const tgName = tgArn.split('/').slice(-2).join('/');
    try {
      const health = await elbClient.send(
        new DescribeTargetHealthCommand({ TargetGroupArn: tgArn })
      );
      const targets = health.TargetHealthDescriptions ?? [];
      if (targets.length === 0) {
        platform.error(`  ${tgName}: NO TARGETS REGISTERED`);
        continue;
      }

      for (const t of targets) {
        const state = t.TargetHealth?.State ?? 'unknown';
        const reason = t.TargetHealth?.Reason ?? '';
        const desc = t.TargetHealth?.Description ?? '';
        const ip = t.Target?.Id ?? '?';
        const port = t.Target?.Port ?? '?';
        const status = state === 'healthy' ? 'HEALTHY' : `UNHEALTHY (${reason})`;

        platform.error(`  ${tgName}: ${ip}:${port} → ${status}`);
        if (desc) platform.error(`    Description: ${desc}`);

        if (state === 'unhealthy' && reason === 'Target.FailedHealthChecks') {
          platform.error(
            '    ⚠ Health checks are failing — likely a networking/SG issue, not an application issue.'
          );
          platform.error(
            '    Check: LB security group egress rules, target SG ingress rules, NACLs, route tables.'
          );
        }
      }
    } catch (err) {
      platform.warning(
        `  Could not check ${tgName}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

async function diagnoseLoadBalancerSecurityGroups(
  platform: CiPlatform,
  elbClient: ElasticLoadBalancingV2Client,
  ec2Client: EC2Client,
  targetGroupArns: string[]
): Promise<void> {
  if (targetGroupArns.length === 0) return;

  const lbArns = new Set<string>();
  try {
    const tgResp = await elbClient.send(
      new DescribeTargetGroupsCommand({ TargetGroupArns: targetGroupArns })
    );
    for (const tg of tgResp.TargetGroups ?? []) {
      for (const arn of tg.LoadBalancerArns ?? []) lbArns.add(arn);
    }
  } catch {
    platform.warning('Could not resolve target groups to load balancers.');
    return;
  }

  if (lbArns.size === 0) return;

  let lbs;
  try {
    lbs = await elbClient.send(
      new DescribeLoadBalancersCommand({
        LoadBalancerArns: [...lbArns],
      })
    );
  } catch {
    platform.warning('Could not describe load balancers.');
    return;
  }

  platform.error('\n--- Load balancer security groups ---');

  for (const lb of lbs.LoadBalancers ?? []) {
    const name = lb.LoadBalancerName ?? '(unknown)';
    const sgIds = lb.SecurityGroups ?? [];
    platform.error(`\n  LB: ${name} (${lb.Type ?? 'unknown'}, ${lb.Scheme ?? 'unknown'})`);

    if (sgIds.length === 0) {
      platform.error('    No security groups attached — all traffic allowed (pre-SG NLB behavior).');
      continue;
    }

    try {
      const sgResp = await ec2Client.send(
        new DescribeSecurityGroupsCommand({ GroupIds: sgIds })
      );

      for (const sg of sgResp.SecurityGroups ?? []) {
        const sgId = sg.GroupId ?? '?';
        const ingress = sg.IpPermissions ?? [];
        const egress = sg.IpPermissionsEgress ?? [];

        platform.error(`    SG: ${sgId} (${sg.Description ?? 'no description'})`);
        platform.error(`      Ingress rules: ${ingress.length}`);
        platform.error(`      Egress rules:  ${egress.length}`);

        if (ingress.length === 0) {
          platform.error(
            '      ⚠ THIS IS LIKELY YOUR BUG: LB security group has ZERO ingress rules.'
          );
          platform.error(
            '      No traffic can reach the load balancer. Health checks will always fail.'
          );
          platform.error(
            '      Fix: Add nlb.connections.allowFromAnyIpv4(ec2.Port.tcp(<port>)) in CDK.'
          );
        }

        const onlyDummyEgress =
          egress.length === 1 &&
          egress[0]?.IpProtocol === 'icmp' &&
          egress[0]?.IpRanges?.[0]?.CidrIp === '255.255.255.255/32';

        if (egress.length === 0 || onlyDummyEgress) {
          platform.error(
            '      ⚠ THIS IS LIKELY YOUR BUG: LB security group has no real egress rules.'
          );
          platform.error(
            '      The LB cannot forward traffic or run health checks against targets.'
          );
          platform.error(
            '      Fix: Add nlb.connections.allowTo(<service>, ec2.Port.tcp(<port>)) in CDK.'
          );
        }

        for (const rule of ingress) {
          const port = rule.FromPort === rule.ToPort
            ? String(rule.FromPort ?? 'all')
            : `${rule.FromPort}-${rule.ToPort}`;
          const sources = [
            ...(rule.IpRanges ?? []).map((r) => r.CidrIp),
            ...(rule.UserIdGroupPairs ?? []).map((p) => p.GroupId),
          ];
          platform.error(`      IN  ${rule.IpProtocol}:${port} from ${sources.join(', ') || 'none'}`);
        }

        for (const rule of egress) {
          const port = rule.FromPort === rule.ToPort
            ? String(rule.FromPort ?? 'all')
            : `${rule.FromPort}-${rule.ToPort}`;
          const dests = [
            ...(rule.IpRanges ?? []).map((r) => r.CidrIp),
            ...(rule.UserIdGroupPairs ?? []).map((p) => p.GroupId),
          ];
          platform.error(`      OUT ${rule.IpProtocol}:${port} to ${dests.join(', ') || 'none'}`);
        }
      }
    } catch (err) {
      platform.warning(
        `    Could not describe SGs [${sgIds.join(', ')}]: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

async function diagnoseStoppedTaskNetworking(
  platform: CiPlatform,
  ecsClient: ECSClient,
  ec2Client: EC2Client,
  clusterArn: string,
  serviceArn: string
): Promise<void> {
  let taskArns: string[];
  try {
    const resp = await ecsClient.send(
      new ListTasksCommand({
        cluster: clusterArn,
        serviceName: serviceArn,
        desiredStatus: 'STOPPED',
        maxResults: 3,
      })
    );
    taskArns = resp.taskArns ?? [];
  } catch {
    platform.warning('Could not list stopped tasks (cluster likely deleted).');
    return;
  }

  if (taskArns.length === 0) return;

  let tasks;
  try {
    tasks = await ecsClient.send(
      new DescribeTasksCommand({ cluster: clusterArn, tasks: taskArns })
    );
  } catch {
    platform.warning('Could not describe stopped tasks.');
    return;
  }

  platform.error('\n--- Stopped task networking ---');

  for (const task of tasks.tasks ?? []) {
    const taskId = task.taskArn?.split('/').pop() ?? '(unknown)';
    platform.error(`\n  Task ${taskId}:`);
    platform.error(`    Stopped reason: ${task.stoppedReason ?? '(none)'}`);
    platform.error(`    Container health: ${task.healthStatus ?? '(unknown)'}`);

    const eniDetails = task.attachments
      ?.flatMap((a) => a.details ?? [])
      .filter((d) => d.name === 'networkInterfaceId')
      .map((d) => d.value)
      .filter((v): v is string => v !== undefined);

    if (!eniDetails || eniDetails.length === 0) continue;

    try {
      const eniResp = await ec2Client.send(
        new DescribeNetworkInterfacesCommand({
          NetworkInterfaceIds: eniDetails,
        })
      );

      for (const eni of eniResp.NetworkInterfaces ?? []) {
        platform.error(`    ENI: ${eni.NetworkInterfaceId}`);
        platform.error(`      Private IP: ${eni.PrivateIpAddress}`);
        platform.error(`      Subnet: ${eni.SubnetId} (${eni.AvailabilityZone})`);

        const sgIds = eni.Groups?.map((g) => g.GroupId).filter(
          (id): id is string => id !== undefined
        );
        if (sgIds && sgIds.length > 0) {
          platform.error(`      Security groups: ${sgIds.join(', ')}`);
          try {
            const sgResp = await ec2Client.send(
              new DescribeSecurityGroupsCommand({ GroupIds: sgIds })
            );
            for (const sg of sgResp.SecurityGroups ?? []) {
              const ingressCount = sg.IpPermissions?.length ?? 0;
              platform.error(
                `        ${sg.GroupId}: "${sg.Description}" — ${ingressCount} ingress rule(s)`
              );
            }
          } catch {
            /* best-effort */
          }
        }
      }
    } catch {
      platform.warning(`    Could not describe ENI(s) for task ${taskId}.`);
    }
  }
}
