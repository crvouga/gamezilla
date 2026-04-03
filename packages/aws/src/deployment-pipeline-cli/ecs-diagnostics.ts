/**
 * Post-mortem ECS diagnostics: fetches container logs and stopped-task reasons
 * from a failed CloudFormation deployment. Designed to run after rollback, when
 * the ECS cluster/service may already be deleted but CloudWatch log groups are
 * preserved (CDK default removalPolicy: RETAIN).
 */
import {
  CloudWatchLogsClient,
  DescribeLogStreamsCommand,
  GetLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import {
  DescribeStackEventsCommand,
  type CloudFormationClient,
  type StackEvent,
} from '@aws-sdk/client-cloudformation';
import {
  DescribeTasksCommand,
  ECSClient,
  ListTasksCommand,
} from '@aws-sdk/client-ecs';
import { assert } from '@gamezilla/shared/assert';
import type { CiPlatform } from './ci-platform';
import { requireAwsRegion } from './aws';
import { STACK_NAME } from './cfn-shared';
import { diagnoseElbFailures } from './elb-diagnostics';

const MAX_LOG_EVENTS_PER_STREAM = 80;
const MAX_LOG_STREAMS = 3;
const MAX_CFN_EVENT_PAGES = 3;

/**
 * Best-effort ECS post-mortem: prints container logs and stopped-task reasons
 * for any ECS service that failed during the deployment. Swallows all errors
 * so it never prevents the main failure path from running.
 */
export async function diagnoseEcsFailures(
  platform: CiPlatform,
  cfnClient: CloudFormationClient
): Promise<void> {
  const events = await fetchAllRecentEvents(cfnClient);
  if (events.length === 0) return;

  const ecsServiceFailures = events.filter(
    (e) =>
      e.ResourceType === 'AWS::ECS::Service' &&
      e.ResourceStatus?.endsWith('_FAILED')
  );

  if (ecsServiceFailures.length === 0) return;

  platform.error('\n╔══════════════════════════════════════════════╗');
  platform.error('║       ECS SERVICE FAILURE DIAGNOSIS          ║');
  platform.error('╚══════════════════════════════════════════════╝');

  for (const failure of ecsServiceFailures) {
    platform.error(
      `\nFailed service: ${failure.LogicalResourceId ?? '(unknown)'}`
    );
    platform.error(
      `  Reason: ${failure.ResourceStatusReason ?? '(no reason)'}`
    );
    if (failure.PhysicalResourceId) {
      platform.error(`  ARN:    ${failure.PhysicalResourceId}`);
    }
  }

  const region = requireAwsRegion(platform);
  const cwClient = new CloudWatchLogsClient({ region });
  const ecsClient = new ECSClient({ region });

  await tryDiagnoseStoppedTasks(platform, ecsClient, ecsServiceFailures);
  await tryDiagnoseElbConnectivity(platform, region, ecsServiceFailures);
  await tryDiagnoseContainerLogs(platform, cwClient, events);
  printDiagnosisSummary(platform, ecsServiceFailures);
}

/**
 * For each failed ECS service that has load balancers, run the full ELB
 * networking diagnostic: target group health, LB security groups, ENIs.
 */
async function tryDiagnoseElbConnectivity(
  platform: CiPlatform,
  region: string,
  ecsServiceFailures: StackEvent[]
): Promise<void> {
  for (const failure of ecsServiceFailures) {
    const serviceArn = failure.PhysicalResourceId;
    if (!serviceArn) continue;

    const clusterArn = extractClusterArnFromServiceArn(serviceArn);
    if (!clusterArn) continue;

    try {
      await diagnoseElbFailures({
        platform,
        region,
        clusterArn,
        serviceArn,
      });
    } catch {
      platform.warning(
        `ELB diagnostics failed for ${serviceArn} — cluster may have been deleted during rollback.`
      );
    }
  }
}

function printDiagnosisSummary(
  platform: CiPlatform,
  ecsServiceFailures: StackEvent[]
): void {
  platform.error('\n╔══════════════════════════════════════════════╗');
  platform.error('║              DIAGNOSIS SUMMARY               ║');
  platform.error('╚══════════════════════════════════════════════╝');
  platform.error('');
  platform.error(
    '  Service                     │ Status          │ Reason'
  );
  platform.error(
    '  ────────────────────────────┼─────────────────┼──────────────────────────────'
  );

  for (const f of ecsServiceFailures) {
    const name = (f.LogicalResourceId ?? '(unknown)').padEnd(28);
    const status = (f.ResourceStatus ?? '?').padEnd(15);
    const reason = truncate(f.ResourceStatusReason ?? '(none)', 60);
    platform.error(`  ${name} │ ${status} │ ${reason}`);
  }

  platform.error('');
  platform.error('Common root causes:');
  platform.error(
    '  1. LB security group blocks health checks → Check SG ingress/egress above'
  );
  platform.error(
    '  2. Container crashes on start → Check container logs above'
  );
  platform.error(
    '  3. Health check path/port wrong → Check target group config'
  );
  platform.error(
    '  4. VPC/subnet misconfiguration → Check task ENI details above'
  );
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

async function fetchAllRecentEvents(
  client: CloudFormationClient
): Promise<StackEvent[]> {
  const events: StackEvent[] = [];
  let nextToken: string | undefined;

  for (let page = 0; page < MAX_CFN_EVENT_PAGES; page++) {
    const resp = await client.send(
      new DescribeStackEventsCommand({
        StackName: STACK_NAME,
        NextToken: nextToken,
      })
    );
    events.push(...(resp.StackEvents ?? []));
    nextToken = resp.NextToken;
    if (!nextToken) break;
  }
  return events;
}

/**
 * Try to fetch stopped-task reasons from ECS. This is best-effort because the
 * cluster may already be deleted after CloudFormation rollback. ECS retains
 * stopped-task metadata for ~1 hour, but the DescribeTasks call requires a
 * cluster that still exists.
 */
async function tryDiagnoseStoppedTasks(
  platform: CiPlatform,
  ecsClient: ECSClient,
  ecsServiceFailures: StackEvent[]
): Promise<void> {
  for (const failure of ecsServiceFailures) {
    const serviceArn = failure.PhysicalResourceId;
    if (!serviceArn) continue;

    const clusterArn = extractClusterArnFromServiceArn(serviceArn);
    if (!clusterArn) continue;

    try {
      const stopped = await ecsClient.send(
        new ListTasksCommand({
          cluster: clusterArn,
          serviceName: serviceArn,
          desiredStatus: 'STOPPED',
          maxResults: 5,
        })
      );

      const taskArns = stopped.taskArns ?? [];
      if (taskArns.length === 0) continue;

      const described = await ecsClient.send(
        new DescribeTasksCommand({ cluster: clusterArn, tasks: taskArns })
      );

      platform.error('\n--- Stopped ECS tasks ---');
      for (const task of described.tasks ?? []) {
        const taskId = task.taskArn?.split('/').pop() ?? '(unknown)';
        platform.error(`\n  Task ${taskId}:`);
        platform.error(`    Stopped reason: ${task.stoppedReason ?? '(none)'}`);
        platform.error(`    Stop code:      ${task.stopCode ?? '(none)'}`);
        platform.error(
          `    Last status:    ${task.lastStatus ?? '(unknown)'}`
        );
        platform.error(
          `    Desired status: ${task.desiredStatus ?? '(unknown)'}`
        );

        for (const container of task.containers ?? []) {
          if (container.exitCode !== 0 && container.exitCode !== undefined) {
            platform.error(
              `    Container "${container.name}": exit=${container.exitCode} reason="${container.reason ?? '(none)'}"`
            );
          }
        }
      }
    } catch {
      platform.warning(
        `Could not fetch stopped tasks for ${serviceArn} (cluster likely deleted during rollback).`
      );
    }
  }
}

/**
 * Finds CloudWatch log groups from the deployment's CloudFormation events and
 * prints recent log entries. Log groups survive rollback (DELETE_SKIPPED) so
 * this is the most reliable source of container diagnostics.
 */
async function tryDiagnoseContainerLogs(
  platform: CiPlatform,
  cwClient: CloudWatchLogsClient,
  events: StackEvent[]
): Promise<void> {
  const logGroupNames = extractLogGroupNames(events);

  if (logGroupNames.length === 0) {
    platform.warning(
      'No CloudWatch log groups found in deployment events — cannot fetch container logs.'
    );
    return;
  }

  platform.error('\n--- Container logs from CloudWatch ---');

  for (const logGroupName of logGroupNames) {
    try {
      await fetchAndPrintLogs(platform, cwClient, logGroupName);
    } catch (err) {
      platform.warning(
        `Failed to fetch logs from ${logGroupName}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

/**
 * Extract log group names from CloudFormation events. Looks for:
 * - CREATE_COMPLETE events (log group was created during the deployment)
 * - DELETE_SKIPPED events (log group survived rollback — most reliable)
 */
function extractLogGroupNames(events: StackEvent[]): string[] {
  const names = new Set<string>();
  for (const e of events) {
    if (e.ResourceType !== 'AWS::Logs::LogGroup') continue;
    if (!e.PhysicalResourceId) continue;
    const status = e.ResourceStatus ?? '';
    if (
      status === 'CREATE_COMPLETE' ||
      status === 'DELETE_SKIPPED' ||
      status === 'CREATE_IN_PROGRESS'
    ) {
      names.add(e.PhysicalResourceId);
    }
  }
  return [...names];
}

async function fetchAndPrintLogs(
  platform: CiPlatform,
  client: CloudWatchLogsClient,
  logGroupName: string
): Promise<void> {
  platform.error(`\n  Log group: ${logGroupName}`);

  const streams = await client.send(
    new DescribeLogStreamsCommand({
      logGroupName,
      orderBy: 'LastEventTime',
      descending: true,
      limit: MAX_LOG_STREAMS,
    })
  );

  if (!streams.logStreams || streams.logStreams.length === 0) {
    platform.error('    (no log streams — container may not have started)');
    return;
  }

  for (const stream of streams.logStreams) {
    const streamName = stream.logStreamName;
    if (!streamName) continue;

    platform.error(`\n    Stream: ${streamName}`);

    const logEvents = await client.send(
      new GetLogEventsCommand({
        logGroupName,
        logStreamName: streamName,
        limit: MAX_LOG_EVENTS_PER_STREAM,
        startFromHead: false,
      })
    );

    const entries = logEvents.events ?? [];
    if (entries.length === 0) {
      platform.error('      (empty)');
      continue;
    }

    for (const event of entries) {
      const ts = event.timestamp
        ? new Date(event.timestamp).toISOString()
        : '';
      const msg = event.message?.trimEnd() ?? '';
      console.error(`      ${ts}  ${msg}`);
    }
  }
}

function extractClusterArnFromServiceArn(
  serviceArn: string
): string | undefined {
  assert.ok(
    typeof serviceArn === 'string' && serviceArn.length > 0,
    'extractClusterArn: serviceArn must be non-empty'
  );
  const match = serviceArn.match(
    /^arn:aws:ecs:([^:]+):([^:]+):service\/([^/]+)\//
  );
  if (!match) return undefined;
  const [, region, account, cluster] = match;
  return `arn:aws:ecs:${region}:${account}:cluster/${cluster}`;
}
