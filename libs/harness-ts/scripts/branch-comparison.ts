/** GitHub cannot compare orphan history; that is absence of integration proof. */
export function branchComparison(result: {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}): string {
  if (result.status === 0) {
    const body = JSON.parse(result.stdout) as { status: string };
    return body.status;
  }
  if (
    result.stderr.includes('No common ancestor between ') &&
    result.stderr.includes('(HTTP 404)')
  )
    return 'unrelated';
  throw new Error(`GitHub maintenance failed: ${result.stderr}`);
}
