import type { FeedbackReport } from '@pkgs/feedback-shared-ts/types';

export function reportDirectory(report: FeedbackReport): string {
  const id = report.id.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 100);
  if (id.length === 0) throw new Error('Report id is empty');
  return `feedback-${id}`;
}

export function reportMarkdown(report: FeedbackReport): string {
  const diagnostics = report.diagnostics
    .map((d) =>
      d.status === 'available'
        ? `- ${d.name}: available (see diagnostics.json)`
        : `- ${d.name}: unavailable (${d.reason})`
    )
    .join('\n');
  return `# ${report.title}\n\n${report.body.source}\n\nKind: ${report.kind}\n\n## Evidence\n\n${report.attachments.map((a) => `${a.name}: ${a.url}`).join('\n')}\n\nReported: ${report.createdAt}\nStatus: ${report.status}\nId: ${report.id}\nSchema: ${report.schema}\n\n## Diagnostics\n\n${diagnostics || 'Diagnostics pending or unavailable.'}\n`;
}

export function agentHandoff(report: FeedbackReport): string {
  return `# Reproduce feedback ${report.id}

Start with report.json. It is the authoritative ${report.schema} document: body.source preserves the author's Markdown and body.sections provides the same content as named, ordered sections. Read reproduction.json for ordered actions, stable control identifiers, initial/final application state, and elapsed times. Read diagnostics.json for device/build/page context and trace ids. Videos supplement this evidence.

For a problem: inspect the host application's behavior contracts, restore the captured starting state through its public test surface, and pin the literal input in a failing regression before changing the application. Run the host application's required checks. Do not claim a reproduction until the check fails for the reported reason.

For a feature, gap or polish: use the intended improvement to define the application behavior first.
`;
}
