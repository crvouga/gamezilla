import { render } from 'solid-js/web';

import { HarnessReportApp } from './app/report-app';
import type { ReportData } from './types';
import './styles.css';

export const HARNESS_REPORT_TAG = 'harness-report';

export class HarnessReportElement extends HTMLElement {
  #dispose: (() => void) | null = null;
  data: ReportData | null = null;
  frameCss: string | null = null;

  connectedCallback(): void {
    this.style.display = 'block';
    this.style.height = '100%';
    const data = this.#readData();
    const frameCss = this.#readFrameCss();
    this.#dispose = render(
      () => <HarnessReportApp data={data} frameCss={frameCss} />,
      this
    );
  }

  disconnectedCallback(): void {
    this.#dispose?.();
    this.#dispose = null;
  }

  #readData(): ReportData {
    if (this.data) return this.data;
    const attr = this.getAttribute('data-json');
    if (attr) return JSON.parse(attr) as ReportData;
    const script = document.getElementById('report-data');
    if (script?.textContent) {
      return JSON.parse(script.textContent) as ReportData;
    }
    throw new Error('harness-report: missing report data');
  }

  #readFrameCss(): string {
    if (this.frameCss !== null) return this.frameCss;
    const script = document.getElementById('frame-css');
    return script?.textContent ?? '';
  }
}

export function defineHarnessReportElement(): void {
  if (typeof customElements === 'undefined') return;
  if (!customElements.get(HARNESS_REPORT_TAG)) {
    customElements.define(HARNESS_REPORT_TAG, HarnessReportElement);
  }
}

defineHarnessReportElement();
