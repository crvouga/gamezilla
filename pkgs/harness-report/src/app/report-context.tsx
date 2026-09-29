import { createContext, type ParentProps, useContext } from 'solid-js';

import type { ReportData } from '../types';

/** Where a lazily loaded test stands (`ready` once its report and frames are in). */
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
 * Loads a test's steps and frame files on first view. Absent when every test
 * arrives with the report (a standalone HTML file).
 */
export type ReportTestLoader = {
  readonly load: (testId: string) => void;
  readonly state: (testId: string) => TestLoad;
};

export type ReportContextValue = {
  readonly data: ReportData;
  readonly frameCss: string;
  readonly loader: ReportTestLoader | null;
};

const ReportContext = createContext<ReportContextValue>();

export function ReportProvider(
  props: ParentProps<{
    data: ReportData;
    frameCss: string | undefined;
    loader: ReportTestLoader | undefined;
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
