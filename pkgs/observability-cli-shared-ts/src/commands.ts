import type { ResolvedIdentity } from '@pkgs/observability-root-shared-ts/identity-resolver';
import type { NarrateSpan } from '@pkgs/observability-root-shared-ts/narrate';
import type { ObsArgs } from './args';
import { stringFlag } from './args';
import type { CommandResult, Context } from './command-kit';
import { jsonResult, rangeFor, renderRefs, searching } from './command-kit';
import { emptyResult } from './empty-result';
import {
  FORMAT_HEADER,
  heading,
  narratedTrace,
  nextForTrace,
  noResults,
} from './format';
import { HELP } from './help';
import { mutationCommand } from './mutation-chain';
import { personCommand } from './person-command';
import { slow } from './slow-command';

async function last(ctx: Context, args: ObsArgs): Promise<CommandResult> {
  const range = rangeFor(args, ctx.nowMs, '10m');
  if (range === undefined)
    return { code: 2, text: `${HELP}\ninvalid time range` };
  const search = searching(args);
  const errorsOnly = args.flags['errors'] === true;
  const found = await ctx.store.recent(range, {
    errorsOnly,
    ...search.options,
  });
  return renderRefs(ctx, args, {
    refs: errorsOnly ? found.filter((ref) => ref.errorCount > 0) : found,
    range,
    notes: search.notes,
    searched: 'activity',
    subject: errorsOnly ? 'error traces' : 'recent activity',
  });
}

async function find(ctx: Context, args: ObsArgs): Promise<CommandResult> {
  const identifier = args.operands[0];
  const range = rangeFor(args, ctx.nowMs, '24h');
  if (identifier === undefined || range === undefined)
    return { code: 2, text: HELP };
  const identity = await resolveIdentity(ctx, identifier);
  if (identifier.includes('@') && ctx.identityResolver === undefined) {
    return identityUnavailable();
  }
  if (identifier.includes('@') && identity === null) {
    return emptyResult({
      args,
      range,
      store: ctx.store,
      subject: 'identity',
      window: '7d',
    });
  }
  const search = searching(args);
  const match =
    identity === null
      ? await ctx.store.find(identifier, range)
      : {
          kind: 'user' as const,
          value: identity.userId,
          traces: await ctx.store.findByUser(
            identity.userId,
            range,
            search.options
          ),
        };
  if (match === null) {
    return emptyResult({
      args,
      range,
      store: ctx.store,
      subject: identifier,
      window: '7d',
    });
  }
  if (args.flags['json'] === true) return jsonResult(match);
  const result = await renderRefs(ctx, args, {
    refs: match.traces,
    range,
    notes: search.notes,
    subject: identifier,
  });
  return {
    ...result,
    text: `${heading(ctx.store, range)}\nmatched-as: ${identity?.matchedAs ?? match.kind}${identity === null ? '' : ` -> user.id ${identity.userId}`} (${match.traces.length} traces)\n${result.text.split('\n').slice(3).join('\n')}`,
  };
}

function identityUnavailable(): CommandResult {
  return {
    code: 2,
    text: `${FORMAT_HEADER}\nidentity resolver unavailable; raw email is not sent to telemetry\nnext: set OBS_READONLY_DATABASE_URL to a SELECT-only database role`,
  };
}

function resolveIdentity(
  ctx: Context,
  identifier: string
): Promise<ResolvedIdentity | null> {
  return ctx.identityResolver?.resolve(identifier) ?? Promise.resolve(null);
}

async function trace(ctx: Context, args: ObsArgs): Promise<CommandResult> {
  const traceId = args.operands[0];
  if (traceId === undefined) return { code: 2, text: HELP };
  const found = await ctx.store.getTrace(traceId);
  if (found === null)
    return {
      code: 1,
      text: noResults(traceId, { source: ctx.store.source, window: '24h' }),
    };
  if (args.flags['json'] === true) return jsonResult(found);
  return {
    code: 0,
    text: `${heading(ctx.store)}\n${narratedTrace(found)}\n${nextForTrace(found)}`,
  };
}

async function span(ctx: Context, args: ObsArgs): Promise<CommandResult> {
  const [traceId, spanId] = args.operands;
  if (traceId === undefined || spanId === undefined)
    return { code: 2, text: HELP };
  const found = await ctx.store.getTrace(traceId);
  const item = found?.spans.find((candidate) => candidate.spanId === spanId);
  if (item === undefined)
    return {
      code: 1,
      text: noResults(`${traceId}/${spanId}`, {
        source: ctx.store.source,
        window: '24h',
      }),
    };
  if (args.flags['json'] === true) return jsonResult(item);
  const events =
    item.events?.map(
      (event) => `  ${event.name} ${JSON.stringify(event.attributes ?? {})}`
    ) ?? [];
  return {
    code: 0,
    text: [
      heading(ctx.store),
      `span: ${item.name}`,
      `trace-id: ${item.traceId}`,
      `span-id: ${item.spanId}`,
      `status: ${item.status}${item.statusMessage === undefined ? '' : ` (${item.statusMessage})`}`,
      `duration-ms: ${item.durationMs.toFixed(3)}`,
      `attributes: ${JSON.stringify(item.attributes, null, 2)}`,
      'events:',
      ...(events.length === 0 ? ['  (none)'] : events),
      `next: bun obs trace ${item.traceId}`,
    ].join('\n'),
  };
}

async function correlated(
  ctx: Context,
  args: ObsArgs,
  kind: 'test' | 'user'
): Promise<CommandResult> {
  const value = args.operands[0];
  const range = rangeFor(args, ctx.nowMs, '24h');
  if (value === undefined || range === undefined)
    return { code: 2, text: HELP };
  const identity = kind === 'user' ? await resolveIdentity(ctx, value) : null;
  if (
    kind === 'user' &&
    value.includes('@') &&
    ctx.identityResolver === undefined
  )
    return identityUnavailable();
  if (kind === 'user' && value.includes('@') && identity === null) {
    return {
      code: 1,
      text: noResults('identity', {
        source: ctx.store.source,
        window: '7d',
        range,
      }),
    };
  }
  const search = searching(args);
  let refs =
    kind === 'test'
      ? await ctx.store.findByTest(value)
      : await ctx.store.findByUser(
          identity?.userId ?? value,
          range,
          search.options
        );
  if (kind === 'test' && args.flags['last-failure'] === true) {
    refs = refs.filter((ref) => ref.errorCount > 0).slice(0, 1);
  }
  const result = await renderRefs(ctx, args, {
    refs,
    range,
    notes: search.notes,
    subject: `${kind} ${identity?.userId ?? value}`,
  });
  if (identity === null || args.flags['json'] === true) return result;
  return {
    ...result,
    text: `${heading(ctx.store, range)}\nmatched-as: ${identity.matchedAs} -> user.id ${identity.userId}\n${result.text.split('\n').slice(3).join('\n')}`,
  };
}

async function diff(ctx: Context, args: ObsArgs): Promise<CommandResult> {
  const [leftId, rightId] = args.operands;
  if (leftId === undefined || rightId === undefined)
    return { code: 2, text: HELP };
  const [left, right] = await Promise.all([
    ctx.store.getTrace(leftId),
    ctx.store.getTrace(rightId),
  ]);
  if (left === null || right === null)
    return {
      code: 1,
      text: noResults(`${leftId}/${rightId}`, {
        source: ctx.store.source,
        window: '24h',
      }),
    };
  const totals = (spans: readonly NarrateSpan[]) =>
    new Map(spans.map((item) => [item.name, item.durationMs]));
  const a = totals(left.spans);
  const b = totals(right.spans);
  const names = [...new Set([...a.keys(), ...b.keys()])].sort();
  const lines = names.map(
    (name) =>
      `${name}: ${(a.get(name) ?? 0).toFixed(1)}ms -> ${(b.get(name) ?? 0).toFixed(1)}ms`
  );
  return {
    code: 0,
    text: [
      heading(ctx.store),
      `diff: ${leftId} -> ${rightId}`,
      ...lines,
      `next: bun obs trace ${rightId}`,
    ].join('\n'),
  };
}

async function errors(ctx: Context, args: ObsArgs): Promise<CommandResult> {
  const range = rangeFor(args, ctx.nowMs, '1h');
  if (range === undefined) return { code: 2, text: HELP };
  const requestedUser = stringFlag(args, 'user');
  const resolved =
    requestedUser === undefined
      ? null
      : await resolveIdentity(ctx, requestedUser);
  if (
    requestedUser?.includes('@') === true &&
    ctx.identityResolver === undefined
  )
    return identityUnavailable();
  if (
    requestedUser !== undefined &&
    ctx.identityResolver !== undefined &&
    resolved === null
  )
    return emptyResult({
      args,
      range,
      store: ctx.store,
      subject: 'identity',
      window: '7d',
    });
  const search = searching(args);
  const candidates =
    requestedUser === undefined
      ? await ctx.store.recent(range, { errorsOnly: true, ...search.options })
      : await ctx.store.findByUser(
          resolved?.userId ?? requestedUser,
          range,
          search.options
        );
  const refs = candidates.filter((ref) => ref.errorCount > 0);
  return renderRefs(ctx, args, {
    refs,
    range,
    notes: search.notes,
    searched: 'activity',
    subject:
      requestedUser === undefined
        ? 'error traces'
        : `error traces for user ${resolved?.userId ?? requestedUser}`,
  });
}

async function tail(ctx: Context, args: ObsArgs): Promise<CommandResult> {
  const range = rangeFor(args, ctx.nowMs, '1m');
  if (range === undefined) return { code: 2, text: HELP };
  const requestedUser = stringFlag(args, 'user');
  let resolvedUser: ResolvedIdentity | null = null;
  if (requestedUser !== undefined) {
    resolvedUser = await resolveIdentity(ctx, requestedUser);
    if (requestedUser.includes('@') && ctx.identityResolver === undefined)
      return identityUnavailable();
  }
  const search = searching(args);
  const refs =
    requestedUser === undefined
      ? await ctx.store.recent(range, search.options)
      : await ctx.store.findByUser(
          resolvedUser?.userId ?? requestedUser,
          range,
          search.options
        );
  const result = await renderRefs(ctx, args, {
    refs,
    range,
    notes: search.notes,
    searched: 'activity',
    subject:
      requestedUser === undefined
        ? 'activity'
        : `activity for user ${resolvedUser?.userId ?? requestedUser}`,
  });
  if (args.flags['json'] === true) return result;
  return {
    ...result,
    text: `${result.text}\ntail-mode: bounded snapshot; rerun to follow\nnext: bun obs tail${requestedUser === undefined ? '' : ` --user ${resolvedUser?.userId ?? requestedUser}`}`,
  };
}

async function schema(ctx: Context, args: ObsArgs): Promise<CommandResult> {
  const value = await ctx.store.schema();
  if (args.flags['json'] === true) return jsonResult(value);
  const list = (name: string, values: readonly string[]) =>
    `${name}:\n${values.map((item) => `  ${item}`).join('\n')}`;
  return {
    code: 0,
    text: [
      heading(ctx.store),
      list('spans', value.spanNames),
      list('events', value.eventNames),
      list('attributes', value.attributeNames),
      'next: bun obs last',
    ].join('\n'),
  };
}

export async function runCommand(
  ctx: Context,
  args: ObsArgs
): Promise<CommandResult> {
  if (args.command === 'last') return last(ctx, args);
  if (args.command === 'find') return find(ctx, args);
  if (args.command === 'trace') return trace(ctx, args);
  if (args.command === 'span') return span(ctx, args);
  if (args.command === 'mutation') return mutationCommand(ctx, args);
  if (args.command === 'test' || args.command === 'user')
    return correlated(ctx, args, args.command);
  if (args.command === 'errors') return errors(ctx, args);
  if (args.command === 'slow') return slow(ctx, args);
  if (args.command === 'schema') return schema(ctx, args);
  if (args.command === 'diff') return diff(ctx, args);
  if (args.command === 'person') return personCommand(ctx, args);
  if (args.command === 'tail') return tail(ctx, args);
  return { code: args.command === 'help' ? 0 : 2, text: HELP };
}
