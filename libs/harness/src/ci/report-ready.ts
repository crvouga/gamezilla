/** Emitted only after a report-producing task has finished writing its bucket. */
export const REPORT_READY = '::spec-report-ready::';
/** A cacheable completion record, including parts with no tests or timeline. */
export const REPORT_COMPLETION = 'complete.json';

export type ReportTask = {
  readonly taskId: string;
  readonly packageDir: string;
  readonly bucket: string;
};

export function reportTask(taskId: string): ReportTask | null {
  if (taskId === '@apps/product#check:ui-quality')
    return { taskId, packageDir: 'apps/product', bucket: 'ui-quality' };
  const match = /^@(apps|libs|pkgs)\/([a-z0-9-]+)#test:spec:(\d+)$/.exec(
    taskId
  );
  if (match === null) return null;
  return {
    taskId,
    packageDir: `${match[1]}/${match[2]}`,
    bucket: `part-${match[3]}`,
  };
}
