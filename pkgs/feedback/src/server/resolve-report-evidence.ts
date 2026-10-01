import { readBytes } from '@pkgs/object-store/helpers';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { FeedbackAttachment, FeedbackReport } from '../shared/types';
import { EVIDENCE_ID } from './evidence-handler';

export async function resolveReportEvidence(
  report: FeedbackReport,
  store: ObjectStore
): Promise<FeedbackReport> {
  const attachments: FeedbackAttachment[] = [];
  for (const attachment of report.attachments) {
    if (!EVIDENCE_ID.test(attachment.id)) throw new Error('Invalid evidence');
    const metadata = await store.get(`evidence/${attachment.id}.json`);
    if (!metadata) throw new Error('Evidence missing');
    attachments.push(
      JSON.parse(
        new TextDecoder().decode(await readBytes(metadata.body))
      ) as FeedbackAttachment
    );
  }
  return { ...report, attachments };
}
