import { useCallback, useEffect, useRef, useState } from 'react';

import { pageCacheKey } from './data-table-metrics';
import {
  type CacheMaps,
  ensurePageLoad,
  entryToView,
  type PageView,
} from './data-table-page-load';
import type {
  DataTableLoadPage,
  DataTableOrderDir,
  DataTablePageCacheEntry,
} from './data-table-types';

export type UseDataTablePageCacheResult<T> = {
  readonly view: PageView<T>;
  readonly pageIndex: number;
  readonly pageCount: number;
  readonly orderBy: string | null;
  readonly orderDir: DataTableOrderDir;
  readonly setPageIndex: (index: number) => void;
  readonly toggleSort: (columnId: string) => void;
  readonly retry: () => void;
};

export function useDataTablePageCache<T>(args: {
  readonly loadPage: DataTableLoadPage<T>;
  readonly sourceKey: string | number | undefined;
  readonly pageSize: number;
  readonly defaultOrderBy: string | null;
  readonly defaultOrderDir: DataTableOrderDir;
}): UseDataTablePageCacheResult<T> {
  const { loadPage, sourceKey, pageSize, defaultOrderBy, defaultOrderDir } =
    args;
  const {
    pageIndex,
    orderBy,
    orderDir,
    epoch,
    setPageIndex,
    toggleSort,
    bumpEpoch,
  } = useTableNav(defaultOrderBy, defaultOrderDir, sourceKey);
  const [view, setView] = useState<PageView<T>>({ status: 'loading' });
  const mapsRef = useRef<CacheMaps<T>>({
    cache: new Map(),
    inflight: new Map(),
  });
  const loadPageRef = useRef(loadPage);
  loadPageRef.current = loadPage;

  useEffect(() => {
    mapsRef.current = { cache: new Map(), inflight: new Map() };
  }, [epoch]);

  const offset = pageIndex * pageSize;
  const key = pageCacheKey(orderBy, orderDir, offset, pageSize);

  useEffect(() => {
    let cancelled = false;
    const cached = mapsRef.current.cache.get(key);
    if (cached != null) {
      setView(entryToView(cached));
      return;
    }
    setView({ status: 'loading' });
    void ensurePageLoad({
      maps: mapsRef.current,
      key,
      loadPage: loadPageRef.current,
      offset,
      pageSize,
      orderBy,
      orderDir,
    }).then((entry: DataTablePageCacheEntry<T>) => {
      if (!cancelled) setView(entryToView(entry));
    });
    return () => {
      cancelled = true;
    };
  }, [key, offset, pageSize, orderBy, orderDir, epoch]);

  const retry = useCallback(() => {
    mapsRef.current.cache.delete(key);
    mapsRef.current.inflight.delete(key);
    bumpEpoch();
  }, [key, bumpEpoch]);

  const totalCount = view.status === 'ready' ? view.totalCount : 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize) || 1);

  return {
    view,
    pageIndex,
    pageCount: view.status === 'empty' ? 1 : pageCount,
    orderBy,
    orderDir,
    setPageIndex,
    toggleSort,
    retry,
  };
}

function useTableNav(
  defaultOrderBy: string | null,
  defaultOrderDir: DataTableOrderDir,
  sourceKey: string | number | undefined
) {
  const [pageIndex, setPageIndexState] = useState(0);
  const [orderBy, setOrderBy] = useState<string | null>(defaultOrderBy);
  const [orderDir, setOrderDir] = useState<DataTableOrderDir>(defaultOrderDir);
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    setPageIndexState(0);
    setOrderBy(defaultOrderBy);
    setOrderDir(defaultOrderDir);
    setEpoch((e) => e + 1);
  }, [sourceKey, defaultOrderBy, defaultOrderDir]);

  const setPageIndex = useCallback((index: number) => {
    setPageIndexState(Math.max(0, index));
  }, []);

  const toggleSort = useCallback((columnId: string) => {
    setPageIndexState(0);
    setOrderBy((prev) => {
      if (prev === columnId) {
        setOrderDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return columnId;
      }
      setOrderDir('asc');
      return columnId;
    });
    setEpoch((e) => e + 1);
  }, []);

  const bumpEpoch = useCallback(() => setEpoch((e) => e + 1), []);

  return {
    pageIndex,
    orderBy,
    orderDir,
    epoch,
    setPageIndex,
    toggleSort,
    bumpEpoch,
  };
}
