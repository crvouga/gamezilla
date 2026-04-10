export interface Dep {
  readonly name: string;
  readonly bin: string;
  version(): string | null;
  check(): DepStatus;
  /** Latest stable version from upstream (npm / GitHub). Null if lookup failed. */
  fetchLatestVersion(): Promise<string | null>;
  install(): void;
  upgrade(): void;
  verify?(): void;
}

export type DepStatus =
  | { readonly ok: true; readonly version: string }
  | { readonly ok: false; readonly reason: string };
