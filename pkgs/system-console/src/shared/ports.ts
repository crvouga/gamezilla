/**
 * Injected ports so `@pkgs/system-console` never imports apps/libs/test.
 */

import type { Io } from '@pkgs/io';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { ComponentType } from 'react';

export type EmbeddedProductAppProps<R = unknown> = {
  readonly io: Io;
  readonly resources: R;
  readonly embedded: true;
};

export type PlaygroundLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type PlaygroundLogEntry = {
  readonly at: number;
  readonly level: PlaygroundLogLevel;
  readonly msg: string;
  readonly context?: Record<string, unknown>;
};

export type PlaygroundLogBuffer = {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => readonly PlaygroundLogEntry[];
  readonly append: (entry: PlaygroundLogEntry) => void;
};

export type PlaygroundNode = {
  readonly id: string;
  readonly sqlClient: SqlClient;
  readonly logs: PlaygroundLogBuffer;
};

export type PlaygroundActor<R = unknown> = PlaygroundNode & {
  readonly io: Io;
  readonly resources: R;
};

export type PlaygroundSession<R = unknown> = {
  readonly actors: {
    readonly alice: PlaygroundActor<R>;
    readonly bob: PlaygroundActor<R>;
  };
  readonly server: PlaygroundNode;
  dispose(): Promise<void>;
};

export type SystemConsolePorts<R = unknown> = {
  readonly ProductApp: ComponentType<EmbeddedProductAppProps<R>>;
  readonly bootPlayground: () => Promise<PlaygroundSession<R>>;
  /** Process I/O for report HTTP (and playground actor Io is separate). */
  readonly io: Io;
  /**
   * Base path for the mounted console Hono app (no trailing slash).
   * Default `/system-console`.
   */
  readonly reportApiBasePath?: string;
};
