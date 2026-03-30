import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECT_CONFIG } from '../project-config';
import { BaseSetupCommand } from './base-command';
import { CUSTOM_HTTPS_HOSTS, SETUP_DNS_DOMAINS } from './dns-config';
import { parseNameservers } from './ns-parse';
import { AWS_PACKAGE_ROOT, runLocalCapture } from './shared';

const ACM_REGION = 'us-east-1';

export class DomainsStatusCommand extends BaseSetupCommand {
  readonly id = 'domains-status';
  readonly summary =
    'Route53 NS vs public DNS, ACM cert status, CloudFront aliases, HTTPS probes';

  execute(_argv: string[]): void {
    const region = PROJECT_CONFIG.aws.region;
    process.env['AWS_REGION'] = region;
    process.env['AWS_DEFAULT_REGION'] = region;

    const outputsPath = join(AWS_PACKAGE_ROOT, 'cdk-outputs.json');
    let stack: Record<string, string> | undefined;
    if (existsSync(outputsPath)) {
      try {
        const doc = JSON.parse(readFileSync(outputsPath, 'utf8')) as Record<
          string,
          Record<string, string>
        >;
        stack = doc[PROJECT_CONFIG.stack.name];
      } catch {
        console.log(`(could not parse ${outputsPath})`);
      }
    } else {
      console.log(`(no ${outputsPath} — some checks skipped)\n`);
    }

    console.log('=== Route53 outputs vs public NS (dig) ===\n');
    for (const { domain, outputKey } of SETUP_DNS_DOMAINS) {
      const raw = stack?.[outputKey];
      if (raw !== undefined && raw !== '') {
        console.log(`${outputKey} (${domain}): ${raw}`);
        const expected = parseNameservers(raw);
        const dig = runLocalCapture('dig', ['NS', domain, '+short']);
        const actual =
          dig.ok && dig.stdout.trim().length > 0
            ? parseNameservers(dig.stdout)
            : new Set<string>();
        const match =
          expected.size > 0 &&
          actual.size > 0 &&
          [...expected].every((n) => actual.has(n)) &&
          [...actual].every((n) => expected.has(n));
        console.log(
          `  dig NS ${domain}: ${match ? 'MATCH' : 'MISMATCH or incomplete'}`
        );
        if (!match) {
          console.log(`    expected: ${[...expected].join(', ')}`);
          console.log(`    actual:   ${[...actual].join(', ') || '(empty)'}`);
        }
      } else {
        console.log(`${domain}: no ${outputKey} in outputs (custom domain off?)`);
      }
      console.log('');
    }

    console.log('=== ACM (us-east-1, CloudFront region) ===\n');
    const list = runLocalCapture(
      'aws',
      [
        'acm',
        'list-certificates',
        '--region',
        ACM_REGION,
        '--output',
        'json',
      ],
      { cwd: AWS_PACKAGE_ROOT }
    );
    if (list.ok) {
      try {
        const doc = JSON.parse(list.stdout) as {
          CertificateSummaryList?: {
            DomainName?: string;
            Status?: string;
          }[];
        };
        const rows = doc.CertificateSummaryList ?? [];
        const interesting = rows.filter(
          (c) =>
            typeof c.DomainName === 'string' &&
            (c.DomainName.includes('gamezilla') ||
              c.DomainName.includes('patchdb'))
        );
        if (interesting.length === 0) {
          console.log('(no gamezilla/patchdb certs found in summary)');
        } else {
          for (const c of interesting) {
            console.log(
              `  ${c.DomainName ?? '?'}  status=${c.Status ?? '?'}`
            );
          }
        }
      } catch {
        console.log(list.stdout.slice(0, 500));
      }
    } else {
      console.log(`aws acm list-certificates failed: ${list.stderr}`);
    }
    console.log('');

    console.log('=== CloudFront alternate domain names ===\n');
    const webId = stack?.WebDistributionId;
    const patchId = stack?.PatchDbAppDistributionId;
    for (const [label, id] of [
      ['WebApp', webId],
      ['PatchDbApp', patchId],
    ] as const) {
      if (id === undefined || id === '') {
        console.log(`${label}: (no distribution id in outputs)\n`);
        continue;
      }
      const g = runLocalCapture(
        'aws',
        [
          'cloudfront',
          'get-distribution',
          '--id',
          id,
          '--query',
          'Distribution.DistributionConfig.{Aliases:Aliases,Enabled:Enabled}',
          '--output',
          'json',
        ],
        { cwd: AWS_PACKAGE_ROOT }
      );
      if (g.ok) {
        console.log(`${label} (${id}): ${g.stdout.trim()}`);
      } else {
        console.log(`${label}: get-distribution failed: ${g.stderr}`);
      }
      console.log('');
    }

    console.log('=== HTTPS reachability (custom hosts) ===\n');
    for (const url of CUSTOM_HTTPS_HOSTS) {
      const curl = runLocalCapture('curl', [
        '-sS',
        '-o',
        '/dev/null',
        '-w',
        '%{http_code}',
        '--max-time',
        '15',
        url,
      ]);
      if (curl.ok) {
        console.log(`  ${url} → HTTP ${curl.stdout.trim()}`);
      } else {
        console.log(`  ${url} → failed (${curl.stderr.trim() || curl.code})`);
      }
    }
  }
}
