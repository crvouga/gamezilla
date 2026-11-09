// @io-wall-ok — read-only operator command; database credentials authorize access.
import { cancellationFeedbackReportCommand } from '@libs/billing-server-ts/cancellation-feedback-report';
import { appPostgresDbScope } from '@libs/db-shared-ts/scope';
import { openPgClient } from '@pkgs/sql-client-postgres-server-ts/connect';

const connectionString = process.env['DATABASE_URL']?.trim();
if (!connectionString)
  throw new Error('Provide DATABASE_URL through the configured secrets runner');
const { sqlClient } = await openPgClient({
  connectionString,
  dbScope: appPostgresDbScope(),
});
try {
  const report = await cancellationFeedbackReportCommand(
    sqlClient,
    process.argv.slice(2)
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await sqlClient.disconnect();
}
