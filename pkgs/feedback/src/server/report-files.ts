import type { FeedbackReport } from '../shared/types';

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
  return `# ${report.title}\n\n${report.description}\n\nKind: ${report.kind}\n\n## Evidence\n\n${report.attachments.map((a) => `${a.name}: ${a.url}`).join('\n')}\n\nReported: ${report.createdAt}\nStatus: ${report.status}\nId: ${report.id}\n\n## Diagnostics\n\n${diagnostics || 'Diagnostics pending or unavailable.'}\n`;
}

export function agentHandoff(report: FeedbackReport): string {
  return `# Reproduce feedback ${report.id}

Read report.json for the exact observed and expected outcomes. Read reproduction.json for ordered actions, stable control identifiers, initial/final product state, and elapsed times. Read diagnostics.json for device/build/page context and trace ids. Videos supplement this evidence.

For a problem: inspect existing specs, restore the captured starting state in the appropriate public harness, and express the expected outcome as a product scenario using spec-upsert. Use spec-implement to pin this literal input and demonstrate the failure before changing the product. Run spec-audit and the package checks. Do not claim a reproduction until the check fails for the reported reason.

For a feature, gap or polish: use the intended improvement to define the product behavior first.
`;
}
