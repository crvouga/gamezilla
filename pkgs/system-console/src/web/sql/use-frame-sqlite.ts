import { useEffect, useRef, useState } from 'react';

import type { SimulationFrameDatabase } from '../../types';
import { testFrameUrl } from '../api-client';
import {
  type FrameSqliteHandle,
  fetchAndOpenFrameDb,
  listSchemaObjects,
  type SchemaObject,
} from './frame-sqlite';

export type UseFrameSqliteState = {
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  readonly error: string | null;
  readonly handle: FrameSqliteHandle | null;
  readonly schema: readonly SchemaObject[];
};

export function useFrameSqlite(args: {
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly node: SimulationFrameDatabase | null;
}): UseFrameSqliteState {
  const { bucketId, runId, testId, node } = args;
  const [status, setStatus] = useState<UseFrameSqliteState['status']>('idle');
  const [error, setError] = useState<string | null>(null);
  const [handle, setHandle] = useState<FrameSqliteHandle | null>(null);
  const [schema, setSchema] = useState<readonly SchemaObject[]>([]);
  const cacheRef = useRef<Map<string, FrameSqliteHandle>>(new Map());
  const activeShaRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      for (const h of cacheRef.current.values()) h.close();
      cacheRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (node == null) {
      activeShaRef.current = null;
      setHandle(null);
      setSchema([]);
      setStatus('idle');
      setError(null);
      return;
    }

    const sha = node.sha256;
    const file = node.file;
    activeShaRef.current = sha;
    const cached = cacheRef.current.get(sha);
    if (cached) {
      setHandle(cached);
      setSchema(listSchemaObjects(cached.db));
      setStatus('ready');
      setError(null);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);
    const url = testFrameUrl(bucketId, runId, testId, file);
    void fetchAndOpenFrameDb({ url, sha256: sha })
      .then((opened) => {
        if (cancelled || activeShaRef.current !== sha) {
          opened.close();
          return;
        }
        // Cap cache size — keep the latest few dumps.
        if (cacheRef.current.size >= 4) {
          const oldest = cacheRef.current.keys().next().value;
          if (oldest !== undefined) {
            cacheRef.current.get(oldest)?.close();
            cacheRef.current.delete(oldest);
          }
        }
        cacheRef.current.set(sha, opened);
        setHandle(opened);
        setSchema(listSchemaObjects(opened.db));
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled || activeShaRef.current !== sha) return;
        setHandle(null);
        setSchema([]);
        setStatus('error');
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [bucketId, runId, testId, node?.sha256, node?.file]);

  return { status, error, handle, schema };
}
