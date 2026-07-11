import { asKeyword } from '@pkgs/keyword/keyword';
import { jsonKvCodec } from '@pkgs/kv/kv-state-codec';
import { useKvState } from '@pkgs/kv/use-kv-state';
import { useCallback } from 'react';

import { SEARCH_HISTORY_LIMIT } from '../shared/search-types';

const SEARCH_HISTORY_KEY = asKeyword('search/history');
const SEARCH_HISTORY_VALUE_ATTR = asKeyword('search/value');

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === 'string')
  );
}

const SEARCH_HISTORY_CODEC = jsonKvCodec(
  SEARCH_HISTORY_VALUE_ATTR,
  isStringArray
);

export function useSearchHistory() {
  const [queries, setQueries] = useKvState<string[]>({
    key: SEARCH_HISTORY_KEY,
    default: [],
    codec: SEARCH_HISTORY_CODEC,
  });

  const touch = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (trimmed.length === 0) return;
      setQueries((prev) => {
        const next = prev.filter((entry) => entry !== trimmed);
        next.unshift(trimmed);
        return next.slice(0, SEARCH_HISTORY_LIMIT);
      });
    },
    [setQueries]
  );

  const clear = useCallback(() => {
    setQueries([]);
  }, [setQueries]);

  return { queries, touch, clear };
}
