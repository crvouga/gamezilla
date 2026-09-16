import { render } from 'solid-js/web';

import { SimReportApp } from './app/report-app';
import type { ReportData } from './types';
import './styles.css';

export const SIM_REPORT_TAG = 'sim-report';

export class SimReportElement extends HTMLElement {
  #dispose: (() => void) | null = null;
  data: ReportData | null = null;
  frameCss: string | null = null;

  connectedCallback(): void {
    this.style.display = 'block';
    this.style.height = '100%';
    const data = this.#readData();
    const frameCss = this.#readFrameCss();
    this.#dispose = render(
      () => <SimReportApp data={data} frameCss={frameCss} />,
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
    throw new Error('sim-report: missing report data');
  }

  #readFrameCss(): string {
    if (this.frameCss !== null) return this.frameCss;
    const script = document.getElementById('frame-css');
    return script?.textContent ?? '';
  }
}

export function defineSimReportElement(): void {
  if (typeof customElements === 'undefined') return;
  if (!customElements.get(SIM_REPORT_TAG)) {
    customElements.define(SIM_REPORT_TAG, SimReportElement);
  }
}

defineSimReportElement();
