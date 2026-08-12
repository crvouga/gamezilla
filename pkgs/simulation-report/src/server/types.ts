import type { ObjectStore } from '@pkgs/object-store/interface';

export type ReportBucket = {
  readonly id: string;
  readonly label: string;
  readonly store: ObjectStore;
};
