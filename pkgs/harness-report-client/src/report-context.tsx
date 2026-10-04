import type { ReportData } from '@pkgs/harness-report-shared/types';
import { createContext, type ParentProps, useContext } from 'solid-js';

/**
 * Where a lazily loaded test stands. `ready` means the timeline is in;
 * frame files arrive afterwards, one at a time.
 */
export type TestLoad =
  | { readonly kind: 'ready' }
  | {
      readonly kind: 'loading';
      readonly frames: number;
      readonly framesTotal: number | null;
    }
  | { readonly kind: 'missing' }
  | { readonly kind: 'error'; readonly message: string };

/**
 * Loads a test's steps on first view, then individual frame files as the
 * scrubber reaches them. Absent when every test arrives with its frames
 * (a standalone HTML file).
 */
export type ReportTestLoader = {
  readonly load: (testId: string) => void;
  readonly ensureBlob?: (testId: string, file: string) => void;
  readonly state: (testId: string) => TestLoad;
};

export type ReportContextValue = {
  readonly data: ReportData;
  readonly frameCss: string;
  readonly loader: ReportTestLoader | null;
  /** True while the commit's test list has not arrived yet. */
  readonly pending: boolean;
};

const ReportContext = createContext<ReportContextValue>();

export function ReportProvider(
  props: ParentProps<{
    data: ReportData;
    frameCss: string | undefined;
    loader: ReportTestLoader | undefined;
    pending?: boolean | undefined;
  }>
) {
  // Getters: a streamed report grows `data` and fills in `frameCss` later.
  const value: ReportContextValue = {
    get data() {
      return props.data;
    },
    get frameCss() {
      return props.frameCss ?? '';
    },
    get loader() {
      return props.loader ?? null;
    },
    get pending() {
      return props.pending === true;
    },
  };
  return (
    <ReportContext.Provider value={value}>
      {props.children}
    </ReportContext.Provider>
  );
}

export function useReport(): ReportContextValue {
  const ctx = useContext(ReportContext);
  if (!ctx) throw new Error('useReport requires ReportProvider');
  return ctx;
}
