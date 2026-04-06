import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  type ResultByTime,
} from '@aws-sdk/client-cost-explorer';
import type { Command } from '../command';
import type { CiPlatform } from '../platform';
import { runStep } from '../platform';
import { ensureAwsEnvCredentials } from '../lib/aws-creds';
import { PROJECT_CONFIG } from '../../project-config';
import { REPO_ROOT } from '../paths';
import { fmt, kv } from '../fmt';

type ServiceTotal = { service: string; amount: number };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function elapsedDays(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

function estimate(total: number, elapsed: number, monthDays: number): number {
  return (total / elapsed) * monthDays;
}

function parseGroups(results: ResultByTime[]): ServiceTotal[] {
  const totals = new Map<string, number>();
  for (const day of results) {
    for (const group of day.Groups ?? []) {
      const service = group.Keys?.[0] ?? 'Unknown';
      const amount = parseFloat(
        group.Metrics?.['UnblendedCost']?.Amount ?? '0',
      );
      totals.set(service, (totals.get(service) ?? 0) + amount);
    }
  }
  return [...totals.entries()]
    .map(([service, amount]) => ({ service, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function formatUsd(amount: number): string {
  return `$${amount.toFixed(4)}`;
}

function buildReport(
  start: string,
  end: string,
  services: ServiceTotal[],
): string {
  const total = services.reduce((s, r) => s + r.amount, 0);
  const elapsed = elapsedDays(start, end);
  const monthDays = daysInMonth(new Date(start));
  const nameWidth = Math.max(
    'Service'.length,
    ...services.map((s) => s.service.length),
  );

  const lines: string[] = [
    `# AWS Cost Report`,
    ``,
    `Period: ${start} — ${end} (${elapsed}/${monthDays} days)`,
    `Region: ${PROJECT_CONFIG.aws.region}`,
    ``,
    `| ${'Service'.padEnd(nameWidth)} | MTD Cost   | Est. Month |`,
    `| ${'-'.repeat(nameWidth)} | ---------- | ---------- |`,
  ];

  for (const { service, amount } of services) {
    if (amount === 0) continue;
    const est = estimate(amount, elapsed, monthDays);
    lines.push(
      `| ${service.padEnd(nameWidth)} | ${formatUsd(amount).padStart(10)} | ${formatUsd(est).padStart(10)} |`,
    );
  }

  const totalEst = estimate(total, elapsed, monthDays);
  lines.push(
    `| ${'**Total**'.padEnd(nameWidth)} | ${formatUsd(total).padStart(10)} | ${formatUsd(totalEst).padStart(10)} |`,
    ``,
    `Generated: ${new Date().toISOString()}`,
  );

  return lines.join('\n') + '\n';
}

function printReport(services: ServiceTotal[], start: string, end: string): void {
  const total = services.reduce((s, r) => s + r.amount, 0);
  const elapsed = elapsedDays(start, end);
  const monthDays = daysInMonth(new Date(start));
  const totalEst = estimate(total, elapsed, monthDays);

  console.log('');
  kv('Period', `${start} → ${end} (${elapsed}/${monthDays} days)`);
  kv('Region', PROJECT_CONFIG.aws.region);
  console.log('');

  const col1 = 44;
  const col2 = 11;
  console.log(
    `  ${'Service'.padEnd(col1)} ${'MTD'.padStart(col2)}  ${'Est. Month'.padStart(col2)}`,
  );
  console.log(fmt.dim(`  ${'-'.repeat(col1)} ${'-'.repeat(col2)}  ${'-'.repeat(col2)}`));

  for (const { service, amount } of services) {
    if (amount === 0) continue;
    const est = estimate(amount, elapsed, monthDays);
    console.log(
      `  ${fmt.dim(service.padEnd(col1))} ${fmt.bold(formatUsd(amount).padStart(col2))}  ${fmt.yellow(formatUsd(est).padStart(col2))}`,
    );
  }

  console.log('');
  console.log(
    `  ${'Total'.padEnd(col1)} ${fmt.green(fmt.bold(formatUsd(total).padStart(col2)))}  ${fmt.yellow(fmt.bold(formatUsd(totalEst).padStart(col2)))}`,
  );
  console.log('');
}

const REPORT_PATH = resolve(REPO_ROOT, '.cost-report.md');

export class CostReportCommand implements Command {
  readonly id = 'cost-report';
  readonly summary = 'Fetch AWS monthly cost breakdown';
  readonly group = 'main' as const;

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    process.env['AWS_REGION'] =
      process.env['AWS_REGION'] ?? PROJECT_CONFIG.aws.region;
    ensureAwsEnvCredentials();

    const start = monthStartIso();
    const end = todayIso();

    const services = await runStep(
      this.platform,
      `Fetch cost data ${start} → ${end}`,
      async () => {
        const client = new CostExplorerClient({
          region: PROJECT_CONFIG.aws.region,
        });
        const resp = await client.send(
          new GetCostAndUsageCommand({
            TimePeriod: { Start: start, End: end },
            Granularity: 'DAILY',
            Metrics: ['UnblendedCost'],
            GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
          }),
        );
        return parseGroups(resp.ResultsByTime ?? []);
      },
    );

    printReport(services, start, end);

    const markdown = buildReport(start, end, services);
    writeFileSync(REPORT_PATH, markdown, 'utf8');
    this.platform.notice(`Report written to ${REPORT_PATH}`);
  }
}
