import { assert } from '@gamezilla/shared/assert';
import {
  CloudFormationClient,
  DeleteStackCommand,
  DescribeStacksCommand,
  UpdateTerminationProtectionCommand,
  waitUntilStackDeleteComplete,
} from '@aws-sdk/client-cloudformation';
import { BasePipelineCommand } from './base-command';
import { requireAwsRegion } from './aws';
import type { CiPlatform } from './ci-platform';
import { runStep } from './ci-platform';
import { STACK_NAME } from './cfn-shared';

const IN_PROGRESS_STATES = new Set([
  'CREATE_IN_PROGRESS',
  'UPDATE_IN_PROGRESS',
  'UPDATE_COMPLETE_CLEANUP_IN_PROGRESS',
  'UPDATE_ROLLBACK_IN_PROGRESS',
  'UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS',
  'DELETE_IN_PROGRESS',
  'IMPORT_IN_PROGRESS',
  'IMPORT_ROLLBACK_IN_PROGRESS',
]);

const MAX_DELETE_WAIT = 1800;
const SETTLE_POLL_INTERVAL_MS = 15_000;
const SETTLE_MAX_POLLS = 120;

export class CdkDestroyCommand extends BasePipelineCommand {
  readonly id = 'cdk-destroy';
  readonly summary = 'Idempotent teardown of the CDK stack (GamezillaStack)';

  constructor(platform: CiPlatform) {
    super(platform);
  }

  async execute(argv: string[]): Promise<void> {
    assert.array(argv, 'execute: argv must be an array');
    const region = requireAwsRegion(this.platform);
    const client = new CloudFormationClient({ region });

    const gone = await runStep(this.platform, 'Check if CDK stack exists', () =>
      this.isStackGone(client)
    );

    if (gone) {
      this.platform.notice(`Stack "${STACK_NAME}" does not exist — nothing to destroy.`);
      return;
    }

    await runStep(this.platform, 'Wait for in-progress operations', () =>
      this.waitForSettled(client)
    );

    await runStep(this.platform, 'Disable termination protection', () =>
      this.disableTerminationProtection(client)
    );

    await runStep(this.platform, 'Empty S3 buckets (CDK)', () =>
      this.emptyBuckets(region)
    );

    await runStep(this.platform, 'Empty Route53 hosted zones (CDK)', () =>
      this.emptyHostedZones(region)
    );

    await runStep(this.platform, 'Delete CDK stack', () =>
      this.deleteStack(client)
    );

    await runStep(this.platform, 'Clean up CDKToolkit (best-effort)', () =>
      this.cleanupCdkToolkit(client)
    );

    this.platform.notice(`CDK stack "${STACK_NAME}" fully destroyed.`);
  }

  private async isStackGone(client: CloudFormationClient): Promise<boolean> {
    const stack = await this.describeStack(client);
    if (stack === null) return true;
    if (stack.status === 'DELETE_COMPLETE') return true;
    return false;
  }

  private async waitForSettled(client: CloudFormationClient): Promise<void> {
    for (let i = 0; i < SETTLE_MAX_POLLS; i++) {
      const stack = await this.describeStack(client);
      if (stack === null) return;
      if (!IN_PROGRESS_STATES.has(stack.status)) return;

      this.platform.notice(`Stack is ${stack.status} — waiting to settle (poll ${i + 1})...`);
      await sleep(SETTLE_POLL_INTERVAL_MS);
    }
    this.platform.warning('Stack still in-progress after max polls — attempting destroy anyway.');
  }

  private async disableTerminationProtection(client: CloudFormationClient): Promise<void> {
    const stack = await this.describeStack(client);
    if (stack === null) return;

    try {
      await client.send(new UpdateTerminationProtectionCommand({
        StackName: STACK_NAME,
        EnableTerminationProtection: false,
      }));
      this.platform.notice('Termination protection disabled.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('does not exist')) return;
      this.platform.warning(`Could not disable termination protection: ${msg} — will attempt delete anyway.`);
    }
  }

  private emptyBuckets(region: string): void {
    const buckets = this.discoverBucketNames(region);
    for (const bucket of buckets) {
      this.platform.notice(`Emptying S3 bucket: ${bucket}`);
      const r = Bun.spawnSync(
        ['aws', 's3', 'rm', `s3://${bucket}`, '--recursive', '--region', region],
        { stdout: 'pipe', stderr: 'pipe' }
      );
      if (r.exitCode !== 0) {
        const stderr = r.stderr.toString();
        if (stderr.includes('NoSuchBucket') || stderr.includes('does not exist')) {
          this.platform.notice(`Bucket ${bucket} already gone.`);
        } else {
          this.platform.warning(`Could not empty bucket ${bucket}: ${stderr} — delete may fail for this resource.`);
        }
      }
    }
  }

  private discoverBucketNames(region: string): string[] {
    try {
      const r = Bun.spawnSync(
        ['aws', 'cloudformation', 'list-stack-resources', '--stack-name', STACK_NAME, '--region', region, '--output', 'json'],
        { stdout: 'pipe', stderr: 'pipe' }
      );
      if (r.exitCode !== 0) return [];
      const data = JSON.parse(r.stdout.toString()) as {
        StackResourceSummaries?: Array<{
          ResourceType?: string;
          PhysicalResourceId?: string;
        }>;
      };
      return (data.StackResourceSummaries ?? [])
        .filter((r) => r.ResourceType === 'AWS::S3::Bucket' && r.PhysicalResourceId)
        .map((r) => r.PhysicalResourceId as string);
    } catch {
      return [];
    }
  }

  private emptyHostedZones(region: string): void {
    const zoneIds = this.discoverHostedZoneIds(region);
    for (const zoneId of zoneIds) {
      this.platform.notice(`Emptying Route53 hosted zone: ${zoneId}`);
      this.emptyHostedZone(zoneId);
    }
  }

  private discoverHostedZoneIds(region: string): string[] {
    try {
      const r = Bun.spawnSync(
        ['aws', 'cloudformation', 'list-stack-resources', '--stack-name', STACK_NAME, '--region', region, '--output', 'json'],
        { stdout: 'pipe', stderr: 'pipe' }
      );
      if (r.exitCode !== 0) return [];
      const data = JSON.parse(r.stdout.toString()) as {
        StackResourceSummaries?: Array<{
          ResourceType?: string;
          PhysicalResourceId?: string;
        }>;
      };
      return (data.StackResourceSummaries ?? [])
        .filter((s) => s.ResourceType === 'AWS::Route53::HostedZone' && s.PhysicalResourceId)
        .map((s) => s.PhysicalResourceId as string);
    } catch {
      return [];
    }
  }

  private emptyHostedZone(zoneId: string): void {
    try {
      const r = Bun.spawnSync(
        ['aws', 'route53', 'list-resource-record-sets', '--hosted-zone-id', zoneId, '--output', 'json'],
        { stdout: 'pipe', stderr: 'pipe' }
      );
      if (r.exitCode !== 0) {
        const stderr = r.stderr.toString();
        if (stderr.includes('NoSuchHostedZone') || stderr.includes('does not exist')) {
          this.platform.notice(`Zone ${zoneId} already gone.`);
          return;
        }
        this.platform.warning(`Could not list record sets for zone ${zoneId}: ${stderr}`);
        return;
      }

      const data = JSON.parse(r.stdout.toString()) as {
        ResourceRecordSets?: Array<Record<string, unknown> & { Name: string; Type: string }>;
      };

      const deletable = (data.ResourceRecordSets ?? []).filter(
        (rrs) => rrs.Type !== 'NS' && rrs.Type !== 'SOA'
      );

      if (deletable.length === 0) {
        this.platform.notice(`Zone ${zoneId} has no deletable records.`);
        return;
      }

      const changeBatch = JSON.stringify({
        Changes: deletable.map((rrs) => ({
          Action: 'DELETE',
          ResourceRecordSet: rrs,
        })),
      });

      const del = Bun.spawnSync(
        ['aws', 'route53', 'change-resource-record-sets', '--hosted-zone-id', zoneId, '--change-batch', changeBatch],
        { stdout: 'pipe', stderr: 'pipe' }
      );

      if (del.exitCode !== 0) {
        this.platform.warning(`Could not delete records in zone ${zoneId}: ${del.stderr.toString()}`);
      } else {
        this.platform.notice(`Deleted ${deletable.length} record(s) from zone ${zoneId}.`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('NoSuchHostedZone') || msg.includes('does not exist')) {
        this.platform.notice(`Zone ${zoneId} already gone.`);
        return;
      }
      this.platform.warning(`Error emptying zone ${zoneId}: ${msg} — delete may fail for this resource.`);
    }
  }

  private async deleteStack(client: CloudFormationClient): Promise<void> {
    const stack = await this.describeStack(client);
    if (stack === null || stack.status === 'DELETE_COMPLETE') {
      this.platform.notice('Stack already deleted.');
      return;
    }

    if (stack.status === 'DELETE_IN_PROGRESS') {
      this.platform.notice('Stack delete already in progress — waiting...');
      await waitUntilStackDeleteComplete(
        { client, maxWaitTime: MAX_DELETE_WAIT },
        { StackName: STACK_NAME }
      );
      return;
    }

    this.platform.notice(`Deleting stack "${STACK_NAME}" (current status: ${stack.status})...`);

    try {
      await client.send(new DeleteStackCommand({ StackName: STACK_NAME }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('does not exist')) {
        this.platform.notice('Stack was already deleted.');
        return;
      }
      throw e;
    }

    try {
      await waitUntilStackDeleteComplete(
        { client, maxWaitTime: MAX_DELETE_WAIT },
        { StackName: STACK_NAME }
      );
    } catch {
      const after = await this.describeStack(client);
      if (after !== null && after.status === 'DELETE_FAILED') {
        this.platform.warning(`Stack delete failed (status: ${after.status}). Retrying with --retain-resources...`);
        await this.retryDeleteWithRetain(client);
        return;
      }
    }

    this.platform.notice(`Stack "${STACK_NAME}" deleted.`);
  }

  private async retryDeleteWithRetain(client: CloudFormationClient): Promise<void> {
    const failedResources = await this.getFailedDeleteResources(client);
    if (failedResources.length === 0) {
      this.platform.warning('No specific failed resources found — attempting force delete.');
    }

    try {
      await client.send(new DeleteStackCommand({
        StackName: STACK_NAME,
        RetainResources: failedResources.length > 0 ? failedResources : undefined,
      }));
      await waitUntilStackDeleteComplete(
        { client, maxWaitTime: MAX_DELETE_WAIT },
        { StackName: STACK_NAME }
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('does not exist')) return;
      this.platform.error(`Retry delete failed: ${msg}. Manual cleanup may be needed.`);
      throw e;
    }
  }

  private async getFailedDeleteResources(client: CloudFormationClient): Promise<string[]> {
    try {
      const resp = await client.send(new DescribeStacksCommand({ StackName: STACK_NAME }));
      const stack = resp.Stacks?.[0];
      if (!stack) return [];
      // When DELETE_FAILED, the stack status reason sometimes mentions the logical IDs
      // But the real way is to look at stack resources with DELETE_FAILED status
      const { DescribeStackEventsCommand } = await import('@aws-sdk/client-cloudformation');
      const events = await client.send(new DescribeStackEventsCommand({ StackName: STACK_NAME }));
      return (events.StackEvents ?? [])
        .filter((e) => e.ResourceStatus === 'DELETE_FAILED' && e.LogicalResourceId)
        .map((e) => e.LogicalResourceId!)
        .filter((id, i, arr) => arr.indexOf(id) === i);
    } catch {
      return [];
    }
  }

  private async cleanupCdkToolkit(client: CloudFormationClient): Promise<void> {
    try {
      const resp = await client.send(new DescribeStacksCommand({ StackName: 'CDKToolkit' }));
      const stack = resp.Stacks?.[0];
      if (!stack) {
        this.platform.notice('CDKToolkit stack not found — nothing to clean up.');
        return;
      }
      this.platform.notice('CDKToolkit stack exists. Leaving it in place (shared bootstrap resource).');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('does not exist')) {
        this.platform.notice('CDKToolkit stack not found — already clean.');
        return;
      }
      this.platform.warning(`Could not check CDKToolkit: ${msg}`);
    }
  }

  private async describeStack(
    client: CloudFormationClient
  ): Promise<{ status: string } | null> {
    try {
      const out = await client.send(new DescribeStacksCommand({ StackName: STACK_NAME }));
      const s = out.Stacks?.[0];
      if (!s || !s.StackStatus) return null;
      return { status: s.StackStatus };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('does not exist')) return null;
      throw e;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
