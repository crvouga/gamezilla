import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';

/**
 * Every bug report received, one row per report (`id` is the report's own
 * id). The row is the durable queue between receiving a bug report and
 * filing it as an issue: `filed_at` is empty until the issue exists.
 */
export const feedbackBugReports = defineTable({
  domain: 'feedback',
  name: 'feedback_bug_reports',
  columns: {
    reporter_id: 'text',
    /** The UTC day it was received (`2026-03-02`), for the daily limits. */
    received_day: 'text',
    received_at: 'timestamp',
    /** The object-store folder holding report.json, report.md and screenshots. */
    archive_key: 'text',
    issue_url: 'text',
    filed_at: 'timestamp',
    attempts: 'integer',
    next_attempt_at: 'timestamp',
    last_error: 'text',
  },
  indexes: [
    ['received_day', 'reporter_id'],
    ['filed_at', 'next_attempt_at'],
  ],
});

export const feedbackSchema = registerTables([feedbackBugReports]);
