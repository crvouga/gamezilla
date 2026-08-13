import { useCallback, useEffect, useRef, useState } from 'react';

import type { SimulationFrameDatabase } from '../../types';
import { wallNowMs } from '../wall';
import { runSql, type SqlQueryResult } from './frame-sqlite';
import type { SchemaInspectTarget } from './schema-browser';
import { listSqlHistory, pushSqlHistory } from './sql-history';
import type { SqlResultsBrowseControls } from './sql-results';
import {
  buildTableCountSql,
  buildTablePageSql,
  DEFAULT_PAGE_SIZE,
  indexInspectSql,
  type TableBrowse,
} from './table-browse';
import { useFrameSqlite } from './use-frame-sqlite';

export const DEFAULT_SQL =
  "SELECT name, type FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name;";

type FrameDb = Parameters<typeof runSql>[0];
type SqliteHandle = NonNullable<ReturnType<typeof useFrameSqlite>['handle']>;
type RunBrowseOpts = { readonly recordHistory?: boolean };
type RunBrowse = (next: TableBrowse, opts?: RunBrowseOpts) => void;

export function useSqliteQuerySession(args: {
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly node: SimulationFrameDatabase | null;
}) {
  const nodeId = args.node?.nodeId ?? '';
  const sha256 = args.node?.sha256 ?? '';
  const sqlite = useFrameSqlite({
    bucketId: args.bucketId,
    runId: args.runId,
    testId: args.testId,
    node: args.node,
  });
  const session = useQuerySessionState(nodeId, sha256);
  const runFreeform = useRunFreeform(sqlite.handle, nodeId, sha256, session);
  const runBrowse = useRunBrowse(sqlite.handle, nodeId, sha256, session);

  useStickyBrowseFlush({
    status: sqlite.status,
    handle: sqlite.handle,
    sha256,
    runBrowse,
    session,
  });

  return {
    sqlite,
    sql: session.sql,
    setSql: session.setSql,
    browse: session.browse,
    result: session.result,
    totalRows: session.totalRows,
    queryError: session.queryError,
    history: session.history,
    runFreeform,
    runBrowse,
    onInspect: (target: SchemaInspectTarget) =>
      inspectSchemaTarget({
        target,
        browse: session.browse,
        hasDb: Boolean(sqlite.handle),
        runBrowse,
        runFreeform,
        setSql: session.setSql,
        setBrowse: session.setBrowse,
        pendingBrowseRef: session.pendingBrowseRef,
      }),
    clearBrowse: () => {
      session.setBrowse(null);
      session.pendingBrowseRef.current = null;
    },
    browseControls: browseControlsFor({
      browse: session.browse,
      totalRows: session.totalRows,
      runBrowse,
    }),
  };
}

type QuerySessionState = ReturnType<typeof useQuerySessionState>;

function useQuerySessionState(nodeId: string, sha256: string) {
  const [sql, setSql] = useState(DEFAULT_SQL);
  const [browse, setBrowse] = useState<TableBrowse | null>(null);
  const [result, setResult] = useState<SqlQueryResult | null>(null);
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [historyTick, setHistoryTick] = useState(0);
  const history = listSqlHistory(nodeId);
  void historyTick;
  const countCacheRef = useRef<Map<string, number>>(new Map());
  const pendingBrowseRef = useRef<TableBrowse | null>(null);
  const appliedShaRef = useRef<string | null>(null);
  const browseRef = useRef(browse);
  browseRef.current = browse;

  useEffect(() => {
    setResult(null);
    setTotalRows(null);
    setQueryError(null);
    countCacheRef.current.clear();
    appliedShaRef.current = null;
    if (browseRef.current) {
      pendingBrowseRef.current = browseRef.current;
    }
  }, [sha256]);

  return {
    sql,
    setSql,
    browse,
    setBrowse,
    result,
    setResult,
    totalRows,
    setTotalRows,
    queryError,
    setQueryError,
    history,
    setHistoryTick,
    countCacheRef,
    pendingBrowseRef,
    appliedShaRef,
  };
}

function useStickyBrowseFlush(args: {
  readonly status: string;
  readonly handle: ReturnType<typeof useFrameSqlite>['handle'];
  readonly sha256: string;
  readonly runBrowse: RunBrowse;
  readonly session: QuerySessionState;
}): void {
  const { status, handle, sha256, runBrowse, session } = args;
  useEffect(() => {
    if (status !== 'ready' || !handle || !sha256) return;
    const pending = session.pendingBrowseRef.current;
    const sticky = pending ?? session.browse;
    if (!sticky) return;
    if (!pending && session.appliedShaRef.current === sha256) return;
    runBrowse(sticky, { recordHistory: false });
  }, [
    status,
    handle,
    sha256,
    runBrowse,
    session.browse,
    session.pendingBrowseRef,
    session.appliedShaRef,
  ]);
}

function useRunFreeform(
  handle: ReturnType<typeof useFrameSqlite>['handle'],
  nodeId: string,
  sha256: string,
  session: QuerySessionState
) {
  const {
    setResult,
    setTotalRows,
    setBrowse,
    setQueryError,
    setHistoryTick,
    pendingBrowseRef,
    appliedShaRef,
  } = session;
  return useCallback(
    (nextSql: string) => {
      if (!handle) return;
      try {
        setResult(runSql(handle.db, nextSql));
        setTotalRows(null);
        setBrowse(null);
        pendingBrowseRef.current = null;
        appliedShaRef.current = sha256;
        setQueryError(null);
        pushSqlHistory(nodeId, nextSql, wallNowMs());
        setHistoryTick((n) => n + 1);
      } catch (err) {
        setResult(null);
        setTotalRows(null);
        setQueryError(err instanceof Error ? err.message : String(err));
      }
    },
    [
      handle,
      nodeId,
      sha256,
      setResult,
      setTotalRows,
      setBrowse,
      setQueryError,
      setHistoryTick,
      pendingBrowseRef,
      appliedShaRef,
    ]
  );
}

function useRunBrowse(
  handle: ReturnType<typeof useFrameSqlite>['handle'],
  nodeId: string,
  sha256: string,
  session: QuerySessionState
): RunBrowse {
  const {
    setSql,
    setBrowse,
    setResult,
    setTotalRows,
    setQueryError,
    setHistoryTick,
    countCacheRef,
    pendingBrowseRef,
    appliedShaRef,
  } = session;
  return useCallback(
    (next: TableBrowse, opts?: RunBrowseOpts) => {
      if (!handle || !sha256) return;
      applyBrowsePage({
        handle,
        nodeId,
        sha256,
        next,
        recordHistory: opts?.recordHistory !== false,
        setSql,
        setBrowse,
        setResult,
        setTotalRows,
        setQueryError,
        setHistoryTick,
        countCache: countCacheRef.current,
        pendingBrowseRef,
        appliedShaRef,
      });
    },
    [
      handle,
      nodeId,
      sha256,
      setSql,
      setBrowse,
      setResult,
      setTotalRows,
      setQueryError,
      setHistoryTick,
      countCacheRef,
      pendingBrowseRef,
      appliedShaRef,
    ]
  );
}

function applyBrowsePage(args: {
  readonly handle: SqliteHandle;
  readonly nodeId: string;
  readonly sha256: string;
  readonly next: TableBrowse;
  readonly recordHistory: boolean;
  readonly setSql: (sql: string) => void;
  readonly setBrowse: (browse: TableBrowse | null) => void;
  readonly setResult: (result: SqlQueryResult | null) => void;
  readonly setTotalRows: (n: number | null) => void;
  readonly setQueryError: (err: string | null) => void;
  readonly setHistoryTick: (fn: (n: number) => number) => void;
  readonly countCache: Map<string, number>;
  readonly pendingBrowseRef: { current: TableBrowse | null };
  readonly appliedShaRef: { current: string | null };
}): void {
  const pageSql = buildTablePageSql(args.next);
  args.setSql(pageSql);
  args.setBrowse(args.next);
  args.pendingBrowseRef.current = null;
  args.appliedShaRef.current = args.sha256;
  try {
    let total: number | null = null;
    try {
      total = resolveBrowseTotal({
        db: args.handle.db,
        sha256: args.sha256,
        name: args.next.name,
        cache: args.countCache,
      });
    } catch {
      total = null;
    }
    args.setResult(runSql(args.handle.db, pageSql));
    args.setTotalRows(total);
    args.setQueryError(null);
    if (args.recordHistory) {
      pushSqlHistory(args.nodeId, pageSql, wallNowMs());
      args.setHistoryTick((n) => n + 1);
    }
  } catch (err) {
    args.setResult(null);
    args.setTotalRows(null);
    args.setQueryError(err instanceof Error ? err.message : String(err));
  }
}

function resolveBrowseTotal(args: {
  readonly db: FrameDb;
  readonly sha256: string;
  readonly name: string;
  readonly cache: Map<string, number>;
}): number {
  const cacheKey = `${args.sha256}:${args.name}`;
  const cached = args.cache.get(cacheKey);
  if (cached !== undefined) return cached;
  const countResult = runSql(args.db, buildTableCountSql(args.name));
  const raw = countResult.rows[0]?.[0];
  let total = typeof raw === 'bigint' ? Number(raw) : Number(raw ?? 0);
  if (!Number.isFinite(total)) total = 0;
  args.cache.set(cacheKey, total);
  return total;
}

function inspectSchemaTarget(args: {
  readonly target: SchemaInspectTarget;
  readonly browse: TableBrowse | null;
  readonly hasDb: boolean;
  readonly runBrowse: RunBrowse;
  readonly runFreeform: (nextSql: string) => void;
  readonly setSql: (sql: string) => void;
  readonly setBrowse: (browse: TableBrowse | null) => void;
  readonly pendingBrowseRef: { current: TableBrowse | null };
}): void {
  if (args.target.type === 'index') {
    const nextSql = indexInspectSql(args.target.name);
    args.setSql(nextSql);
    args.setBrowse(null);
    args.pendingBrowseRef.current = null;
    if (args.hasDb) args.runFreeform(nextSql);
    return;
  }
  const next: TableBrowse = {
    kind: args.target.type,
    name: args.target.name,
    page: 0,
    pageSize: args.browse?.pageSize ?? DEFAULT_PAGE_SIZE,
  };
  if (args.hasDb) {
    args.runBrowse(next, { recordHistory: true });
    return;
  }
  args.pendingBrowseRef.current = next;
  args.setBrowse(next);
  args.setSql(buildTablePageSql(next));
}

function browseControlsFor(args: {
  readonly browse: TableBrowse | null;
  readonly totalRows: number | null;
  readonly runBrowse: RunBrowse;
}): SqlResultsBrowseControls | null {
  const { browse, totalRows, runBrowse } = args;
  if (!browse) return null;
  return {
    browse,
    totalRows,
    onPageChange: (page) =>
      runBrowse(
        { ...browse, page: Math.max(0, page) },
        { recordHistory: true }
      ),
    onPageSizeChange: (pageSize) =>
      runBrowse({ ...browse, page: 0, pageSize }, { recordHistory: true }),
  };
}
