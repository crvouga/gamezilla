/** Workflow report need state (shared to avoid import cycles). */
export interface NeedState {
  readonly result: string;
  readonly outputs?: Readonly<Record<string, string>>;
}
