import { defineTable } from '@pkgs/db-schema';

export const clientConfig = defineTable({
  domain: 'client_config',
  name: 'client_config',
  columns: {
    value: 'json',
  },
  deprecations: [
    ['enabled', 'unused — use *_enabled / null scalar rows'],
    [
      'google_web_client_id',
      'unused column — value lives in row id=google_web_client_id',
    ],
  ],
});

export const CLIENT_CONFIG_TABLES = [clientConfig] as const;
