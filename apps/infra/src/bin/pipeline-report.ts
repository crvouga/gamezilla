import { writePipelineReportToSummary } from '../cli/lib/write-pipeline-report';

try {
  writePipelineReportToSummary();
} catch (e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  console.error(message);
  if (e instanceof Error && e.stack) {
    console.error(e.stack);
  }
  process.exit(1);
}
process.exit(0);
