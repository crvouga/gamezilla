import type { IdentityResolver } from '@pkgs/observability-root-shared/identity-resolver';
import { parseLocalClock } from '@pkgs/observability-root-shared/local-clock';
import { DEFAULT_SLOW_MS } from '@pkgs/observability-root-shared/person-timeline';
import { findPersonTrouble } from '@pkgs/observability-root-shared/person-trouble';
import type { TraceStore } from '@pkgs/observability-root-shared/types';
import type { ObsArgs } from './args';
import { stringFlag } from './args';
import { FORMAT_HEADER } from './format';
import { HELP } from './help';
import { parseDuration } from './time';

const DIRECTORY_UNAVAILABLE = [
  FORMAT_HEADER,
  'identity directory unavailable; set OBS_READONLY_DATABASE_URL to a SELECT-only database role',
  'next: bun obs person --name "<name>" --at "6:33pm MST" --place "<place>"',
].join('\n');

type PersonContext = {
  readonly identityResolver?: IdentityResolver;
  readonly nowMs: number;
  readonly store: TraceStore;
};

/** Name, place, and the time on a person's own clock. */
export async function personCommand(
  ctx: PersonContext,
  args: ObsArgs
): Promise<{ readonly code: 0 | 1 | 2; readonly text: string }> {
  const name = stringFlag(args, 'name') ?? args.operands[0];
  const at = stringFlag(args, 'at');
  if (name === undefined || at === undefined) return { code: 2, text: HELP };
  const resolver = ctx.identityResolver;
  const resolvePeople = resolver?.resolvePeople;
  if (resolver === undefined || resolvePeople === undefined) {
    return { code: 2, text: DIRECTORY_UNAVAILABLE };
  }
  const windowMs = parseDuration(stringFlag(args, 'window') ?? '30m');
  if (windowMs === undefined) return { code: 2, text: HELP };
  const slowMs = slowThreshold(args);
  if (slowMs === undefined) return { code: 2, text: HELP };
  const place = stringFlag(args, 'place');
  const source = stringFlag(args, 'source');
  const report = await findPersonTrouble(
    ctx.store,
    { resolvePeople: (asked) => resolvePeople.call(resolver, asked) },
    {
      name,
      at: clockText(at, stringFlag(args, 'timezone'), ctx.nowMs),
      nowMs: ctx.nowMs,
      windowMs,
      slowMs,
      ...(args.flags['all'] === true ? { all: true } : {}),
      ...(place === undefined ? {} : { place }),
      ...(source === undefined ? {} : { sourceFlag: source }),
    }
  );
  if (report.unavailable) return { code: 2, text: DIRECTORY_UNAVAILABLE };
  if (args.flags['json'] === true && report.data !== undefined) {
    return {
      code: report.code,
      text: JSON.stringify(
        { format: FORMAT_HEADER, data: report.data },
        null,
        2
      ),
    };
  }
  return { code: report.code, text: report.text };
}

/** `--slow-ms 500`; a span this long gets its own timeline row. */
function slowThreshold(args: ObsArgs): number | undefined {
  const text = stringFlag(args, 'slow-ms');
  if (text === undefined) return DEFAULT_SLOW_MS;
  const value = Number(text);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function clockText(
  at: string,
  zone: string | undefined,
  nowMs: number
): string {
  if (zone === undefined || parseLocalClock(at, nowMs) !== undefined) return at;
  return `${at} ${zone}`;
}
