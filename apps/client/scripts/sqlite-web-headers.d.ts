export declare const SQLITE_WEB_COOP: string;
export declare const SQLITE_WEB_COEP: string;

export declare function applySqliteWebIsolationHeaders(res: {
  setHeader: (name: string, value: string) => void;
}): void;

export declare function applySqliteWebIsolationHeadersToFetch(
  headers: { set: (name: string, value: string) => void }
): void;
