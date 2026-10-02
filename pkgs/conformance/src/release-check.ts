export type ReleaseEvidence = {
  readonly obligation: string;
  readonly edition: string;
  readonly status: string;
  readonly automated: boolean;
};
export type ReleaseVerdict = {
  readonly edition: string;
  readonly status: 'pass' | 'fail';
  readonly problems: readonly ('failed' | 'unproven' | 'earlier-edition')[];
};
/** A release is approved only by complete automation for the requested edition. */
export function checkRelease(input: {
  readonly edition: string;
  readonly required: readonly string[];
  readonly evidence: readonly ReleaseEvidence[];
}): ReleaseVerdict {
  const problems = new Set<ReleaseVerdict['problems'][number]>();
  if (input.required.length === 0 || input.edition.trim() === '')
    problems.add('unproven');
  for (const obligation of input.required) {
    const records = input.evidence.filter(
      (record) => record.obligation === obligation
    );
    const current = records.filter(
      (record) => record.edition === input.edition
    );
    if (current.some((record) => record.automated && record.status === 'fail'))
      problems.add('failed');
    if (
      !current.some((record) => record.automated && record.status === 'pass')
    ) {
      problems.add(
        records.length > 0 && current.length === 0
          ? 'earlier-edition'
          : 'unproven'
      );
    }
    if (current.some((record) => !record.automated || record.status !== 'pass'))
      problems.add('unproven');
  }
  return {
    edition: input.edition,
    status: problems.size === 0 ? 'pass' : 'fail',
    problems: [...problems],
  };
}
