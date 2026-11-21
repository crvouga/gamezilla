// @io-wall-ok — CLI entry: the scheduled job that files received bug reports as issues
import { fileEnvironmentBugReports } from '@apps/server-ts/bug-report-filing';
import { wallClock } from '@pkgs/clock-shared-ts/wall';
import { createGlobalHttpClient } from '@pkgs/http-client-shared-ts/global';

const result = await fileEnvironmentBugReports(process.env, {
  http: createGlobalHttpClient(),
  clock: wallClock,
});
console.log(
  `bug reports filed: ${String(result.filed.length)}, not filed: ${String(result.failed.length)}`
);
for (const failed of result.failed)
  console.log(`::error::bug report ${failed.id} not filed: ${failed.error}`);
if (result.failed.length > 0) process.exitCode = 1;
