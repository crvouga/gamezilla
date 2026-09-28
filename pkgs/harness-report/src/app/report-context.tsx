import { createContext, type ParentProps, useContext } from 'solid-js';

import type { ReportData } from '../types';

export type ReportContextValue = {
  readonly data: ReportData;
  readonly frameCss: string;
};

const ReportContext = createContext<ReportContextValue>();

export function ReportProvider(
  props: ParentProps<{ data: ReportData; frameCss?: string }>
) {
  const value = (): ReportContextValue => ({
    data: props.data,
    frameCss: props.frameCss ?? '',
  });
  return (
    <ReportContext.Provider value={value()}>
      {props.children}
    </ReportContext.Provider>
  );
}

export function useReport(): ReportContextValue {
  const ctx = useContext(ReportContext);
  if (!ctx) throw new Error('useReport requires ReportProvider');
  return ctx;
}
