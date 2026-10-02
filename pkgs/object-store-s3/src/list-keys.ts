import {
  type CommonPrefix,
  ListObjectsV2Command,
  type S3Client,
} from '@aws-sdk/client-s3';

type Directory = {
  readonly keys: readonly string[];
  readonly prefixes: readonly string[];
};

function childPrefixes(
  prefix: string,
  children: readonly CommonPrefix[]
): string[] {
  const prefixes: string[] = [];
  for (const child of children) {
    if (!child.Prefix) continue;
    if (
      !child.Prefix.startsWith(prefix) ||
      child.Prefix.length <= prefix.length
    )
      throw new Error('S3 listing returned an invalid child prefix');
    prefixes.push(child.Prefix);
  }
  return prefixes;
}

async function listDirectory(
  client: S3Client,
  bucket: string,
  prefix: string
): Promise<Directory> {
  // Most snapshot subtrees fit in one page. Read them without walking every
  // per-step directory; split only the subtrees that actually need pagination.
  const first = await client.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix })
  );
  if (!first.IsTruncated)
    return {
      keys: (first.Contents ?? []).flatMap((object) =>
        object.Key ? [object.Key] : []
      ),
      prefixes: [],
    };
  const keys: string[] = [];
  const prefixes: string[] = [];
  let token: string | undefined;
  for (;;) {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        Delimiter: '/',
        ContinuationToken: token,
      })
    );
    for (const object of page.Contents ?? [])
      if (object.Key) keys.push(object.Key);
    for (const child of childPrefixes(prefix, page.CommonPrefixes ?? []))
      prefixes.push(child);
    if (!page.IsTruncated) return { keys, prefixes };
    if (!page.NextContinuationToken || page.NextContinuationToken === token)
      throw new Error('S3 listing pagination did not advance');
    token = page.NextContinuationToken;
  }
}

/** Walk child directories in bounded batches instead of paging a whole tree serially. */
export async function listS3Keys(
  client: S3Client,
  bucket: string,
  prefix: string
): Promise<readonly string[]> {
  const pending = [prefix];
  const seen = new Set(pending);
  const keys: string[] = [];
  while (pending.length > 0) {
    const batch = pending.splice(0, 16);
    const results = await Promise.allSettled(
      batch.map((child) => listDirectory(client, bucket, child))
    );
    for (const result of results) {
      if (result.status === 'rejected') throw result.reason;
      for (const key of result.value.keys) keys.push(key);
      for (const child of result.value.prefixes)
        if (!seen.has(child)) {
          seen.add(child);
          pending.push(child);
        }
    }
  }
  return keys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
