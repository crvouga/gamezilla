export declare const EXPO_SQLITE_WEB_COOP: string;
export declare const EXPO_SQLITE_WEB_COEP: string;

export declare function applyExpoSqliteWebIsolationHeaders(res: {
  setHeader: (name: string, value: string) => void;
}): void;

export declare function applyExpoSqliteWebIsolationHeadersToFetch(
  headers: { set: (name: string, value: string) => void }
): void;
