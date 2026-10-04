import sql from '@pkgs/sql-shared/sql';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
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
  async run({ tx, env }, snapshot) {
    const now = env.now().toISOString();
    await tx.run(sql`
      INSERT INTO auth_devices (
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
        platform = COALESCE(excluded.platform, auth_devices.platform),
        os_name = COALESCE(excluded.os_name, auth_devices.os_name),
        os_version = COALESCE(excluded.os_version, auth_devices.os_version),
        device_model_name = COALESCE(
          excluded.device_model_name,
          auth_devices.device_model_name
        ),
        device_brand = COALESCE(excluded.device_brand, auth_devices.device_brand),
        device_name = COALESCE(excluded.device_name, auth_devices.device_name),
        app_version = COALESCE(excluded.app_version, auth_devices.app_version),
        app_build_number = COALESCE(
          excluded.app_build_number,
          auth_devices.app_build_number
        ),
        user_agent = COALESCE(excluded.user_agent, auth_devices.user_agent)
    `);
  },
});

export const AUTH_MUTATIONS = [ensureDeviceMutation] as const;
