import assert from 'node:assert/strict';
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BaseCiCommand } from './base-command';
import { STACK_NAME, SYNC_URL_DELIM } from './cfn-shared';
import { ghError, ghNotice, mustEnv } from './gh';

type GamezillaStackOutputs = {
  SyncServerUrl?: string;
  WebAppBucketName?: string;
  WebDistributionId?: string;
  WebAppUrl?: string;
  SimVizBucketName?: string;
  SimVizDistributionId?: string;
  SimVizUrl?: string;
  Route53Nameservers?: string;
};

type CdkOutputsFile = Record<string, GamezillaStackOutputs | undefined>;

export class ReadCdkOutputsCommand extends BaseCiCommand {
  readonly id = 'read-cdk-outputs';
  readonly summary = 'aws/cdk-outputs.json → GITHUB_OUTPUT';

  execute(argv: string[]): void {
    assert(Array.isArray(argv));
    const file = argv[3] ?? join(process.cwd(), 'aws', 'cdk-outputs.json');
    assert(typeof file === 'string' && file.length > 0);

    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      ghError(`Failed to read ${file}: ${String(e)}`);
      assert.fail(`read-cdk-outputs: cannot parse ${file}`);
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      ghError(`Invalid CDK outputs JSON (expected object)`);
      assert.fail('read-cdk-outputs: CDK outputs must be a JSON object');
    }
    assert(typeof raw === 'object' && raw !== null && !Array.isArray(raw));
    const doc = raw as CdkOutputsFile;
    const stack = doc[STACK_NAME];
    if (stack === undefined || typeof stack !== 'object') {
      ghError(`Missing ${STACK_NAME} in CDK outputs`);
      assert.fail(`read-cdk-outputs: ${STACK_NAME} key missing`);
    }

    const nonEmpty = (v: string | undefined, field: string): string => {
      if (v === undefined || v === '' || v === 'null') {
        ghError(`GamezillaStack.${field} missing or null`);
        assert.fail(`read-cdk-outputs: ${STACK_NAME}.${field} must be non-empty`);
      }
      assert(v.length > 0);
      return v;
    };

    const toSyncUrl = (syncRaw: string): string => {
      assert(syncRaw.length > 0);
      let host = syncRaw.trim();
      if (host.startsWith('https://')) host = host.slice('https://'.length);
      if (host.startsWith('http://')) host = host.slice('http://'.length);
      assert(host.length > 0);
      return `https://${host}`;
    };

    const syncUrl = toSyncUrl(nonEmpty(stack.SyncServerUrl, 'SyncServerUrl'));
    const webBucket = nonEmpty(stack.WebAppBucketName, 'WebAppBucketName');
    const webDist = nonEmpty(stack.WebDistributionId, 'WebDistributionId');
    const webUrl = nonEmpty(stack.WebAppUrl, 'WebAppUrl');
    const vizBucket = nonEmpty(stack.SimVizBucketName, 'SimVizBucketName');
    const vizDist = nonEmpty(
      stack.SimVizDistributionId,
      'SimVizDistributionId'
    );
    const vizUrl = nonEmpty(stack.SimVizUrl, 'SimVizUrl');
    const nsRaw = nonEmpty(stack.Route53Nameservers, 'Route53Nameservers');

    assert(syncUrl.startsWith('https://'));
    const outPath = mustEnv(process.env['GITHUB_OUTPUT'], 'GITHUB_OUTPUT');
    assert(outPath.length > 0);
    const setGithubOutput = (
      name: string,
      value: string,
      multiline: boolean
    ): void => {
      assert(name.length > 0 && value.length > 0);
      assert(typeof multiline === 'boolean');
      if (multiline) {
        appendFileSync(
          outPath,
          `${name}<<${SYNC_URL_DELIM}\n${value}\n${SYNC_URL_DELIM}\n`,
          'utf8'
        );
      } else {
        appendFileSync(outPath, `${name}=${value}\n`, 'utf8');
      }
    };

    setGithubOutput('sync_url', syncUrl, true);
    setGithubOutput('web_bucket', webBucket, false);
    setGithubOutput('web_dist', webDist, false);
    setGithubOutput('web_url', webUrl, false);
    setGithubOutput('viz_bucket', vizBucket, false);
    setGithubOutput('viz_dist', vizDist, false);
    setGithubOutput('viz_url', vizUrl, false);
    setGithubOutput('nameservers', nsRaw, false);

    ghNotice('CDK outputs mapped to GITHUB_OUTPUT.');
  }
}
