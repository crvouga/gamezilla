import type { IdentityResolver } from '@pkgs/observability-shared/identity-resolver';
import { parseLocalClock } from '@pkgs/observability-shared/local-clock';
import { findPersonTrouble } from '@pkgs/observability-shared/person-trouble';
import type { TraceStore } from '@pkgs/observability-shared/types';
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
  const place = stringFlag(args, 'place');
  const report = await findPersonTrouble(
    ctx.store,
    { resolvePeople: (asked) => resolvePeople.call(resolver, asked) },
    {
      name,
      at: clockText(at, stringFlag(args, 'timezone'), ctx.nowMs),
      nowMs: ctx.nowMs,
      windowMs,
      ...(place === undefined ? {} : { place }),
    }
  );
  if (report.unavailable) return { code: 2, text: DIRECTORY_UNAVAILABLE };
  if (args.flags['json'] === true) {
    return {
      code: report.code,
      text: JSON.stringify({ format: FORMAT_HEADER, data: report }, null, 2),
    };
  }
  return { code: report.code, text: report.text };
}

function clockText(
  at: string,
  zone: string | undefined,
  nowMs: number
): string {
  if (zone === undefined || parseLocalClock(at, nowMs) !== undefined) return at;
  return `${at} ${zone}`;
}
