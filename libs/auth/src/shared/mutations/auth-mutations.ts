import { DEVICES_TABLE } from '@libs/db/shared/auth-tables';
import { defineMutation } from '@pkgs/mutations/core/define-mutation';
import { sql } from '@pkgs/sql';
import { z } from 'zod';

const deviceSnapshot = z.object({
  platform: z.string().nullable(),
  os_name: z.string().nullable(),
  os_version: z.string().nullable(),
  device_model_name: z.string().nullable(),
  device_brand: z.string().nullable(),
  device_name: z.string().nullable(),
  app_version: z.string().nullable(),
  app_build_number: z.string().nullable(),
  user_agent: z.string().nullable(),
});

export const ensureDeviceMutation = defineMutation({
  name: 'ensureDevice',
  args: deviceSnapshot,
  writes: [DEVICES_TABLE.tableName],
  async run({ tx, env }, snapshot) {
    const now = env.now().toISOString();
    await tx.run(sql`
      INSERT INTO devices (
        id, created_at, first_seen_at, last_seen_at,
        platform, os_name, os_version, device_model_name, device_brand,
        device_name, app_version, app_build_number, user_agent
      )
      VALUES (
        ${env.deviceId}, ${now}, ${now}, ${now},
        ${snapshot.platform}, ${snapshot.os_name}, ${snapshot.os_version},
        ${snapshot.device_model_name}, ${snapshot.device_brand},
        ${snapshot.device_name}, ${snapshot.app_version},
        ${snapshot.app_build_number}, ${snapshot.user_agent}
      )
      ON CONFLICT (id) DO UPDATE SET
        last_seen_at = excluded.last_seen_at,
        platform = COALESCE(excluded.platform, devices.platform),
        os_name = COALESCE(excluded.os_name, devices.os_name),
        os_version = COALESCE(excluded.os_version, devices.os_version),
        device_model_name = COALESCE(
          excluded.device_model_name,
          devices.device_model_name
        ),
        device_brand = COALESCE(excluded.device_brand, devices.device_brand),
        device_name = COALESCE(excluded.device_name, devices.device_name),
        app_version = COALESCE(excluded.app_version, devices.app_version),
        app_build_number = COALESCE(
          excluded.app_build_number,
          devices.app_build_number
        ),
        user_agent = COALESCE(excluded.user_agent, devices.user_agent)
    `);
  },
});

export const AUTH_MUTATIONS = [ensureDeviceMutation] as const;
