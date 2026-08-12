import type { ObjectStore } from '@pkgs/object-store/interface';

export type ReportBucket = {
  readonly id: string;
  readonly label: string;
  readonly store: ObjectStore;
  /** Local FS root for `fs.watch` (omit for remote/S3 buckets). */
  readonly watchRoot?: string;
};
