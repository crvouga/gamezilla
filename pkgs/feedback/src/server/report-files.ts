import type { FeedbackReport } from '../shared/types';

export function reportDirectory(report: FeedbackReport): string {
  const id = report.id.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 100);
  if (id.length === 0) throw new Error('Report id is empty');
  return `bug-${id}`;
}

export function reportMarkdown(report: FeedbackReport): string {
  const diagnostics = report.diagnostics
    .map((d) =>
      d.status === 'available'
        ? `- ${d.name}: available (see diagnostics.json)`
        : `- ${d.name}: unavailable (${d.reason})`
    )
    .join('\n');
  return `# ${report.title}\n\n${report.description}\n\nReported: ${report.createdAt}\nStatus: ${report.status}\nId: ${report.id}\n\n## Diagnostics\n\n${diagnostics || 'Diagnostics pending or unavailable.'}\n`;
}
