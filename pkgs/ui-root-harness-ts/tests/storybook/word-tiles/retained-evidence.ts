// @io-wall-ok — persist game evidence in the hosted runner's retained output tree.
import { writeFile } from 'node:fs/promises';
import type { TestInfo } from '@playwright/test';

/** Body attachments stay in reporter memory; file attachments survive artifact upload. */
export async function retainEvidence(
  info: TestInfo,
  name: string,
  data: { body: string | Buffer; contentType: string }
): Promise<void> {
  const path = info.outputPath(`${info.attachments.length}-${name}`);
  await writeFile(path, data.body);
  await info.attach(name, { path, contentType: data.contentType });
}
