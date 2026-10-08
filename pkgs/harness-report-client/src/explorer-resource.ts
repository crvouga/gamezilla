import type { ExplorerData } from '@pkgs/harness-report-shared/explorer-types';
import type { Accessor } from 'solid-js';

export type ExplorerResource = {
  readonly data: Accessor<ExplorerData | undefined>;
  readonly pending: Accessor<boolean>;
  readonly error: Accessor<unknown>;
  readonly readSpec: (path: string) => Promise<string | null>;
};
