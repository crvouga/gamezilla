import type { Timers } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';
import type { CreateId } from '@pkgs/uuid';
import type { EvidenceFile, FeedbackAttachment } from '../shared/types';

type UploadOptions = {
  endpoint: string;
  http: HttpClient;
  timers: Timers;
  createId: CreateId;
};
async function upload(
  options: UploadOptions,
  file: EvidenceFile,
  signal: AbortSignal
): Promise<FeedbackAttachment> {
  const response = await options.http.fetch(
    `${options.endpoint}/evidence/${options.createId()}`,
    {
      method: 'POST',
      credentials: 'omit',
      signal,
      headers: {
        'Content-Type': file.contentType,
        'X-Feedback-Name': encodeURIComponent(file.name),
      },
      body: file.bytes as Uint8Array<ArrayBuffer>,
    }
  );
  if (!response.ok)
    throw new Error(
      'Attachment could not be uploaded. Remove it or try again.'
    );
  const receipt = (await response.json()) as FeedbackAttachment;
  if (
    typeof receipt.id !== 'string' ||
    typeof receipt.url !== 'string' ||
    receipt.size !== file.bytes.byteLength
  )
    throw new Error('Invalid attachment receipt');
  return receipt;
}
export function createEvidenceUploader(options: UploadOptions) {
  return async (file: EvidenceFile): Promise<FeedbackAttachment> => {
    const controller = new AbortController();
    let handle: unknown;
    const deadline = new Promise<never>((_, reject) => {
      handle = options.timers.setTimeout(() => {
        controller.abort();
        reject(
          new Error(
            'Attachment upload timed out. Your feedback is still available to retry.'
          )
        );
      }, 20_000);
    });
    try {
      return await Promise.race([
        upload(options, file, controller.signal),
        deadline,
      ]);
    } finally {
      options.timers.clearTimeout(handle);
    }
  };
}
