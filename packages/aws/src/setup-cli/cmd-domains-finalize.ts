import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert } from '@gamezilla/shared/assert';
import { PROJECT_CONFIG } from '../project-config';
import { BaseSetupCommand } from './base-command';
import { runCdkDeployCustomDomain } from './cdk-domain-deploy';
import { SETUP_DNS_DOMAINS } from './dns-config';
import { parseNameservers } from './ns-parse';
import { AWS_PACKAGE_ROOT, runLocalCapture } from './shared';

export class DomainsFinalizeCommand extends BaseSetupCommand {
  readonly id = 'domains-finalize';
  readonly summary =
    'Verify public NS delegation matches Route53, then CDK phase 2 (ACM + aliases)';

  execute(_argv: string[]): void {
    const region = PROJECT_CONFIG.aws.region;
    process.env['AWS_REGION'] = region;
    process.env['AWS_DEFAULT_REGION'] = region;

    const path = join(AWS_PACKAGE_ROOT, 'cdk-outputs.json');
    if (!existsSync(path)) {
      throw new Error(
        `Missing ${path}. Run: bun run setup domains-bootstrap (or deploy) first`
      );
    }
    const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
    assert.ok(
      typeof raw === 'object' && raw !== null && !Array.isArray(raw),
      'cdk-outputs.json must be an object'
    );
    const stack = (raw as Record<string, Record<string, string> | undefined>)[
      PROJECT_CONFIG.stack.name
    ];
    assert.defined(stack, `${PROJECT_CONFIG.stack.name} missing in cdk-outputs.json`);

    for (const { domain, outputKey } of SETUP_DNS_DOMAINS) {
      const rawNs = stack[outputKey];
      if (rawNs === undefined || rawNs === '') {
        throw new Error(
          `Output ${outputKey} empty — run domains-bootstrap with custom domains first`
        );
      }
      const expected = parseNameservers(rawNs);
      const dig = runLocalCapture('dig', ['NS', domain, '+short']);
      if (!dig.ok) {
        throw new Error(`dig NS ${domain} failed: ${dig.stderr}`);
      }
      const actual = parseNameservers(dig.stdout);
      const missing = [...expected].filter((ns) => !actual.has(ns));
      const extra = [...actual].filter((ns) => !expected.has(ns));
      if (missing.length > 0 || extra.length > 0) {
        console.error(`Expected NS: ${[...expected].join(', ')}`);
        console.error(`Public NS:  ${[...actual].join(', ') || '(none)'}`);
        throw new Error(
          `${domain}: NS delegation does not match Route53 yet. Wait for DNS or fix registrar.`
        );
      }
      console.log(`OK ${domain}: delegation matches Route53 (${actual.size} NS).`);
    }

    console.log(
      '\nDeploying with customDomain=true, customDomainBootstrap=false (TLS + aliases) …'
    );
    runCdkDeployCustomDomain(false);

    console.log('\nDone. Run: bun run setup domains-status\n');
  }
}
