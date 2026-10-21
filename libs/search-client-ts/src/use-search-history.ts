import { SEARCH_HISTORY_LIMIT } from '@libs/search-shared-ts/search-types';
import { asKeyword } from '@pkgs/keyword-shared-ts/keyword';
import { createKvState } from '@pkgs/kv-root-client-ts/solid';
import { jsonKvCodec } from '@pkgs/kv-root-shared-ts/kv-state-codec';

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
  const [queries, setQueries] = createKvState<string[]>({
    key: SEARCH_HISTORY_KEY,
    default: [],
    codec: SEARCH_HISTORY_CODEC,
  });

  const touch = (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length === 0) return;
    setQueries((prev) => {
      const next = prev.filter((entry) => entry !== trimmed);
      next.unshift(trimmed);
      return next.slice(0, SEARCH_HISTORY_LIMIT);
    });
  };

  const clear = () => {
    setQueries([]);
  };

  return {
    get queries() {
      return queries();
    },
    touch,
    clear,
  };
}
