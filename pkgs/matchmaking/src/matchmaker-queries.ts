/**
 * Sql-map query builders for the matchmaking hot path.
 *
 * These are pure functions returning `Sql` — no I/O, no connection. They live
 * alongside `matchmaker.ts` (which composes them into `SqlClient` calls) to
 * keep that file within the Tiger-Style size cap while every queue statement
 * stays a single, inspectable sql map.
 *
 * The matchmaking PL/pgSQL routines (`matchmaking_run_match_pass`,
 * `matchmaking_sweep_expired`, `matchmaking_sweep_matched`) are registered as
 * sql-map functions here with a verbatim (lower-case-preserving) compiler: the
 * default compiler upper-cases function names, but these routine names are
 * grepped verbatim by callers/tests, so we emit them exactly as declared.
 *
 * @internal
 */
import {
  col,
  join,
  raw,
  registerSqlMapFn,
  sql,
  sqlMap,
  type SqlMapOpCompiler,
  type Sql,
} from '@pkgs/sql';

/**
 * Emit `name(args…)` with the name spliced verbatim (not upper-cased like the
 * default fn compiler). Args compile in column position, matching the default.
 */
function verbatimFnCompiler(name: string): SqlMapOpCompiler {
  return (args, ctx) => {
    if (args.length === 0) {
      return raw(`${name}()`);
    }
    return sql`${raw(name)}(${join(
      args.map((a) => ctx.compileExpr(a, true)),
      ', '
    )})`;
  };
}

registerSqlMapFn(
  'matchmaking_run_match_pass',
  verbatimFnCompiler('matchmaking_run_match_pass')
);
registerSqlMapFn(
  'matchmaking_sweep_expired',
  verbatimFnCompiler('matchmaking_sweep_expired')
);
registerSqlMapFn(
  'matchmaking_sweep_matched',
  verbatimFnCompiler('matchmaking_sweep_matched')
);

/**
 * Single-statement read across the waiting + matched tables via UNION ALL with
 * a trailing LIMIT 1 binding to the whole compound.
 */
export function statusLookupQuery(participantId: string): Sql {
  return sqlMap({
    unionAll: [
      {
        select: [
          [['cast', 'waiting', 'text'], 'status'],
          'data',
          'metadata',
          [['cast', null, 'uuid'], 'match_id'],
        ],
        from: 'matchmaking_waiting',
        where: ['=', 'id', participantId],
      },
      {
        select: [
          [['cast', 'matched', 'text'], 'status'],
          'data',
          'metadata',
          'match_id',
        ],
        from: 'matchmaking_matched',
        where: ['=', 'id', participantId],
      },
    ],
    limit: 1,
  });
}

export type RunMatchPassArgs = {
  readonly partitionSignature: string;
  readonly baseRadius: number;
  readonly radiusGrowthPerSecond: number;
  readonly maxRadius: number;
  readonly maxPairsPerPass: number;
  readonly bucketWidth: number;
  readonly groupSize: number;
  readonly nowParam: string | null;
};

/** Set-returning `matchmaking_run_match_pass(...)` call in FROM position. */
export function runMatchPassQuery(args: RunMatchPassArgs): Sql {
  return sqlMap({
    select: ['match_id', 'participant_id', 'joined_at', 'data'],
    from: [
      [
        'matchmaking_run_match_pass',
        ['param', args.partitionSignature],
        args.baseRadius,
        args.radiusGrowthPerSecond,
        args.maxRadius,
        args.maxPairsPerPass,
        args.bucketWidth,
        args.groupSize,
        ['param', args.nowParam],
      ],
      't',
    ],
  });
}

/** Prune `(sig, group_size)` pairs with no remaining waiters (aliased DELETE). */
export function prunePartitionsQuery(): Sql {
  return sqlMap({
    deleteFrom: ['matchmaking_active_partitions', 'ap'],
    where: [
      'not',
      [
        'exists',
        {
          select: [1],
          from: ['matchmaking_waiting', 'w'],
          where: [
            'and',
            ['=', 'w.partition_signature', col('ap.partition_signature')],
            ['=', 'w.group_size', col('ap.group_size')],
          ],
        },
      ],
    ],
  });
}

/** `matchmaking_sweep_expired(sig, maxWaitSeconds, now)` scalar call. */
export function sweepExpiredQuery(args: {
  readonly partitionSignature: string;
  readonly maxWaitSeconds: number;
  readonly nowParam: string | null;
}): Sql {
  return sqlMap({
    select: [
      [
        [
          'matchmaking_sweep_expired',
          ['param', args.partitionSignature],
          args.maxWaitSeconds,
          ['param', args.nowParam],
        ],
        'matchmaking_sweep_expired',
      ],
    ],
  });
}

/** `matchmaking_sweep_matched(retentionSeconds, now)` scalar call. */
export function sweepMatchedQuery(args: {
  readonly matchedRetentionSeconds: number;
  readonly nowParam: string | null;
}): Sql {
  return sqlMap({
    select: [
      [
        [
          'matchmaking_sweep_matched',
          args.matchedRetentionSeconds,
          ['param', args.nowParam],
        ],
        'matchmaking_sweep_matched',
      ],
    ],
  });
}

/** Peer participants sharing a `match_id`, excluding the caller. */
export function statusPeersQuery(matchId: string, participantId: string): Sql {
  return sqlMap({
    select: ['id', 'joined_at', 'data', 'metadata'],
    from: 'matchmaking_matched',
    where: ['and', ['=', 'match_id', matchId], ['<>', 'id', participantId]],
    orderBy: ['joined_at'],
  });
}

/** Installed schema fingerprint row (id = 1). */
export function schemaFingerprintQuery(): Sql {
  return sqlMap({
    select: ['schema_fingerprint'],
    from: 'matchmaking_schema_state',
    where: ['=', 'id', 1],
  });
}

/** Active `(partition_signature, group_size)` pairs, oldest first, capped. */
export function activePartitionsQuery(cap: number): Sql {
  return sqlMap({
    select: ['partition_signature', 'group_size'],
    from: 'matchmaking_active_partitions',
    orderBy: ['first_seen_at'],
    limit: cap,
  });
}
