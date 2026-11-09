// @io-wall-ok — retained browser evidence files, written only in the test output directory.
import { mkdir, writeFile } from 'node:fs/promises';
import type { TestInfo } from '@playwright/test';

/** Body-only attachments are not retained by the list reporter's artifact directory. */
export async function attachHeartsText(
  info: TestInfo,
  name: string,
  body: string
) {
  await mkdir(info.outputDir, { recursive: true });
  const path = info.outputPath(name);
  await writeFile(path, body);
  await info.attach(name, {
    path,
    contentType: name.endsWith('.json') ? 'application/json' : 'text/plain',
  });
}
