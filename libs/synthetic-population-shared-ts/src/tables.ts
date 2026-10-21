import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';

// Durable SQL identifiers remain stable across releases.
export const syntheticPopulationConfig = defineTable({
  domain: 'population',
  name: 'population_config',
  columns: { value: 'json', revision: 'integer' },
});
export const syntheticPopulationUsers = defineTable({
  domain: 'population',
  name: 'population_users',
  columns: {
    account_id: 'text',
    username: 'text',
    email: 'text',
    region: 'text',
    personality: 'json',
    paused: 'boolean',
    worker_id: 'text',
    device_id: 'text',
    generation: 'integer',
    lease_until: 'timestamp',
    activity: 'text',
    checkpoint: 'json',
    application_version: 'text',
    last_action: 'text',
    last_error: 'text',
    inspection_requested_at: 'timestamp',
    inspection: 'json',
  },
  uniqueIndexes: ['account_id', 'email'],
  indexes: ['worker_id', 'lease_until'],
  retiredColumns: [
    {
      name: 'credential',
      type: 'text',
      note: 'Synthetic Users sign in with emailed links; nothing is sealed for them',
    },
  ],
});
/**
 * The internal inbox: sign-in mail addressed to Synthetic Users is kept here
 * and is never sent anywhere. Only a user's leased worker takes its link,
 * once; a taken or superseded row is soft-deleted with its link erased.
 */
export const syntheticPopulationSignInMail = defineTable({
  domain: 'population',
  name: 'population_sign_in_mail',
  columns: {
    email: 'text',
    link: 'text',
    expires_at: 'timestamp',
  },
  indexes: [['email', 'created_at']],
});
export const syntheticPopulationWorkers = defineTable({
  domain: 'population',
  name: 'population_workers',
  columns: {
    application_version: 'text',
    capacity: 'integer',
    draining: 'boolean',
    heartbeat_at: 'timestamp',
    memory_bytes: 'integer',
    cpu_milliseconds: 'integer',
    lease_failures: 'integer',
  },
});
export const syntheticPopulationEvents = defineTable({
  domain: 'population',
  name: 'population_events',
  columns: {
    user_id: 'text',
    worker_id: 'text',
    generation: 'integer',
    application_version: 'text',
    correlation_id: 'text',
    event: 'text',
    context: 'json',
  },
  indexes: [['user_id', 'created_at']],
});
export const syntheticPopulationCommands = defineTable({
  domain: 'population',
  name: 'population_commands',
  columns: {
    user_id: 'text',
    actor_id: 'text',
    command: 'text',
    completed_at: 'timestamp',
  },
  indexes: ['user_id'],
});
export const SYNTHETIC_POPULATION_TABLES = [
  syntheticPopulationConfig,
  syntheticPopulationUsers,
  syntheticPopulationWorkers,
  syntheticPopulationEvents,
  syntheticPopulationCommands,
  syntheticPopulationSignInMail,
] as const;
