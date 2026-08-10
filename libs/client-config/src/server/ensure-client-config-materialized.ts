import { isEqual } from '@pkgs/equal/is-equal';
import type { Io } from '@pkgs/io';
import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  CLIENT_CONFIG_KEYS,
  ClientConfigKey,
  type ClientConfigKeyId,
  type ObservabilityBackendName,
} from '../shared/client-config-keys';
import { ClientConfigRepository } from './client-config-repository';

export type DesiredClientConfig = {
  readonly google: boolean;
  readonly emailPassword: boolean;
  readonly stripe: boolean;
  readonly tts: boolean;
  readonly llm: boolean;
  readonly googleWebClientId: string | null;
  readonly emqxWssUrl: string | null;
  readonly sentryDsn: string | null;
  readonly observabilityBackend: ObservabilityBackendName;
};

type DesiredRow = {
  readonly id: ClientConfigKeyId;
  readonly value: unknown;
};

function trimOrNull(raw: string | null): string | null {
  if (raw === null) return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

function buildDesiredRows(desired: DesiredClientConfig): readonly DesiredRow[] {
  return [
    {
      id: ClientConfigKey.googleEnabled,
      value: desired.google,
    },
    {
      id: ClientConfigKey.googleWebClientId,
      value: trimOrNull(desired.googleWebClientId),
    },
    {
      id: ClientConfigKey.emailPasswordEnabled,
      value: desired.emailPassword,
    },
    {
      id: ClientConfigKey.stripeEnabled,
      value: desired.stripe,
    },
    {
      id: ClientConfigKey.ttsEnabled,
      value: desired.tts,
    },
    {
      id: ClientConfigKey.llmEnabled,
      value: desired.llm,
    },
    {
      id: ClientConfigKey.emqxWssUrl,
      value: trimOrNull(desired.emqxWssUrl),
    },
    {
      id: ClientConfigKey.sentryDsn,
      value: trimOrNull(desired.sentryDsn),
    },
    {
      id: ClientConfigKey.observabilityBackend,
      value: desired.observabilityBackend,
    },
  ];
}

function snapshotForCompare(
  rows: readonly { id: string; value: unknown }[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    out[row.id] = row.value ?? null;
  }
  return out;
}

function liveStoredSnapshot(
  rows: readonly { id: string; value: unknown; deleted_at: string | null }[]
): Record<string, unknown> {
  return snapshotForCompare(rows.filter((r) => r.deleted_at === null));
}

/** Upserts Worker-derived public client_config rows (Layer B). */
export class EnsureClientConfigMaterialized {
  constructor(
    private readonly db: SqlClient,
    private readonly io: Io
  ) {}

  /**
   * Returns whether any row changed (caller should notify sync channels).
   */
  async execute(
    desired: DesiredClientConfig
  ): Promise<{ readonly updated: boolean }> {
    const desiredRows = buildDesiredRows(desired);
    const stored = await new ClientConfigRepository(
      this.db,
      this.io
    ).listAll();
    if (isEqual(liveStoredSnapshot(stored), snapshotForCompare(desiredRows))) {
      return { updated: false };
    }

    const known = new Set<string>(CLIENT_CONFIG_KEYS);

    await this.db.transaction(async (tx) => {
      const repo = new ClientConfigRepository(tx, this.io);
      for (const row of desiredRows) {
        await repo.upsert({ id: row.id, value: row.value });
      }
      for (const row of stored) {
        if (known.has(row.id)) continue;
        if (row.deleted_at !== null) continue;
        await repo.softDelete(row.id);
      }
    });

    return { updated: true };
  }
}
