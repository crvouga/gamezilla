import { createAsync } from '@pkgs/async-client/solid';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  on,
  untrack,
} from 'solid-js';

import { pageCacheKey } from '@pkgs/ui-devtools-shared/data-table-metrics';
import type { CacheMaps, PageView } from '@pkgs/ui-devtools-shared/data-table-page-load';
import { createCacheMaps, ensurePageLoad, entryToView } from '@pkgs/ui-devtools-shared/data-table-page-load';
import type {
  DataTableLoadPage,
  DataTableOrderDir,
  DataTablePageCacheEntry,
} from '@pkgs/ui-devtools-shared/data-table-types';

export type DataTablePageCache<T> = {
  readonly view: Accessor<PageView<T>>;
  readonly pageIndex: Accessor<number>;
  readonly pageCount: Accessor<number>;
  readonly orderBy: Accessor<string | null>;
  readonly orderDir: Accessor<DataTableOrderDir>;
  readonly setPageIndex: (index: number) => void;
  readonly toggleSort: (columnId: string) => void;
  readonly retry: () => void;
};

type PageRequest = {
  readonly key: string;
  readonly offset: number;
  readonly pageSize: number;
  readonly orderBy: string | null;
  readonly orderDir: DataTableOrderDir;
};

function createTableNav(args: {
  readonly defaultOrderBy: Accessor<string | null>;
  readonly defaultOrderDir: Accessor<DataTableOrderDir>;
  readonly sourceKey: Accessor<string | number | undefined>;
  readonly onReset: () => void;
}) {
  const [pageIndex, setPageIndexState] = createSignal(0);
  const [orderBy, setOrderBy] = createSignal<string | null>(
    untrack(args.defaultOrderBy)
  );
  const [orderDir, setOrderDir] = createSignal<DataTableOrderDir>(
    untrack(args.defaultOrderDir)
  );
  const [epoch, setEpoch] = createSignal(0);
  const bumpEpoch = () => {
    args.onReset();
    setEpoch((e) => e + 1);
  };

  createEffect(
    on(
      [args.sourceKey, args.defaultOrderBy, args.defaultOrderDir],
      ([, nextOrderBy, nextOrderDir]) => {
        setPageIndexState(0);
        setOrderBy(nextOrderBy);
        setOrderDir(nextOrderDir);
        bumpEpoch();
      },
      { defer: true }
    )
  );

  const toggleSort = (columnId: string) => {
    setPageIndexState(0);
    if (untrack(orderBy) === columnId) {
      setOrderDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrderBy(columnId);
      setOrderDir('asc');
    }
    bumpEpoch();
  };

  return {
    pageIndex,
    orderBy,
    orderDir,
    epoch,
    setPageIndex: (index: number) => setPageIndexState(Math.max(0, index)),
    toggleSort,
    bumpEpoch,
  };
}

/**
 * Reactive page cache behind `DataTable`: tracks page index / sort, caches
 * page responses per `(orderBy, orderDir, offset, limit)`, and loads misses
 * through `createAsync` so in-flight work is aborted on dispose.
 */
export function createDataTablePageCache<T>(args: {
  readonly loadPage: Accessor<DataTableLoadPage<T>>;
  readonly sourceKey: Accessor<string | number | undefined>;
  readonly pageSize: Accessor<number>;
  readonly defaultOrderBy: Accessor<string | null>;
  readonly defaultOrderDir: Accessor<DataTableOrderDir>;
}): DataTablePageCache<T> {
  let maps: CacheMaps<T> = createCacheMaps<T>();
  const nav = createTableNav({
    defaultOrderBy: args.defaultOrderBy,
    defaultOrderDir: args.defaultOrderDir,
    sourceKey: args.sourceKey,
    onReset: () => {
      maps = createCacheMaps<T>();
    },
  });
  const [view, setView] = createSignal<PageView<T>>({ status: 'loading' });

  const loader = createAsync<DataTablePageCacheEntry<T>, [PageRequest]>({
    operation: (_ctx, req) =>
      ensurePageLoad({
        maps,
        key: req.key,
        loadPage: untrack(args.loadPage),
        offset: req.offset,
        pageSize: req.pageSize,
        orderBy: req.orderBy,
        orderDir: req.orderDir,
      }),
    options: { getKey: (req) => req.key },
  });

  const request = createMemo<PageRequest>(() => {
    const pageSize = args.pageSize();
    const offset = nav.pageIndex() * pageSize;
    const orderBy = nav.orderBy();
    const orderDir = nav.orderDir();
    return {
      key: pageCacheKey(orderBy, orderDir, offset, pageSize),
      offset,
      pageSize,
      orderBy,
      orderDir,
    };
  });

  createEffect(() => {
    // Snapshot on purpose: a resolved page only applies if the table still
    // shows the request (key + epoch) that started the load.
    const staticRequest = request();
    const staticEpoch = nav.epoch();
    const cached = maps.cache.get(staticRequest.key);
    if (cached != null) {
      setView(entryToView(cached));
      return;
    }
    setView({ status: 'loading' });
    const isCurrent = () =>
      untrack(request).key === staticRequest.key &&
      untrack(nav.epoch) === staticEpoch;
    loader.run(staticRequest).then(
      (entry) => {
        if (isCurrent()) setView(entryToView(entry));
      },
      () => {
        /* aborted on dispose */
      }
    );
  });

  const retry = () => {
    const key = untrack(request).key;
    maps.cache.delete(key);
    maps.inflight.delete(key);
    nav.bumpEpoch();
  };

  const pageCount = createMemo(() => {
    const v = view();
    if (v.status !== 'ready') return 1;
    return Math.max(1, Math.ceil(v.totalCount / args.pageSize()) || 1);
  });

  return {
    view,
    pageIndex: nav.pageIndex,
    pageCount,
    orderBy: nav.orderBy,
    orderDir: nav.orderDir,
    setPageIndex: nav.setPageIndex,
    toggleSort: nav.toggleSort,
    retry,
  };
}
